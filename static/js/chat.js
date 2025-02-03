// static/js/chat.js
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('message-form')) {
    showLoading("Carregando...");
    setTimeout(function() {
      hideLoading();
      loadMessages();
    }, 6000);
  }
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const messagesDiv = document.getElementById('messages');
  const usersList = document.getElementById('users-list');
  const usersLoading = document.getElementById('users-loading');
  const locationPopup = document.getElementById('location-popup');
  const popupYes = document.getElementById('popup-yes');
  const popupNo = document.getElementById('popup-no');
  const clearMessagesBtn = document.getElementById('clear-messages');
  const darkModeSwitch = document.getElementById('dark-mode-switch');
  const menuBtn = document.getElementById('menu-btn');
  const menuPopup = document.getElementById('menu-popup');
  let pendingLocation = null;
  let lastMessageId = 0;
  let currentUsers = [];
  const customIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color:#d32f2f;font-size:28px;"></i>',
    className: 'custom-div-icon',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
  const socket = io();
  const map = L.map('map').setView([0, 0], 2);
  window.map = map;
  let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  if (darkModeSwitch) {
    darkModeSwitch.addEventListener('change', function() {
      if (darkModeSwitch.checked) {
        document.body.classList.add('dark-mode');
        map.eachLayer(function(layer) {
          if (layer.options && layer.options.attribution && layer.options.attribution.indexOf('OpenStreetMap') > -1) {
            map.removeLayer(layer);
          }
        });
        tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(map);
      } else {
        document.body.classList.remove('dark-mode');
        map.eachLayer(function(layer) {
          if (layer.options && layer.options.attribution && layer.options.attribution.indexOf('CARTO') > -1) {
            map.removeLayer(layer);
          }
        });
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
      }
    });
  }

  if (menuBtn && menuPopup) {
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (menuPopup.style.display === 'none' || menuPopup.style.display === '') {
        menuPopup.style.display = 'block';
      } else {
        menuPopup.style.display = 'none';
      }
    });
    document.addEventListener('click', function(e) {
      if (!menuPopup.contains(e.target) && e.target !== menuBtn) {
        menuPopup.style.display = 'none';
      }
    });
  }

  function loadMessages() {
    fetch('/get_messages')
      .then(response => response.json())
      .then(data => {
        messagesDiv.innerHTML = '';
        data.messages.forEach(msg => {
          const msgElem = document.createElement('div');
          msgElem.classList.add('message');
          if (msg.is_location) {
            msgElem.innerHTML = `<strong>${msg.username}</strong> enviou uma <a href="#map" onclick="setMapView(${msg.latitude}, ${msg.longitude}); return false;">localização</a>.`;
            L.marker([msg.latitude, msg.longitude], {icon: customIcon}).addTo(map)
              .bindPopup(`${msg.username} está aqui.`);
          } else {
            msgElem.innerHTML = `<strong>${msg.username}:</strong> ${msg.content}`;
          }
          messagesDiv.appendChild(msgElem);
          lastMessageId = msg.id;
        });
      });
  }

  socket.on('new_message', function(data) {
    const msgElem = document.createElement('div');
    msgElem.classList.add('message');
    if (data.is_location) {
      msgElem.innerHTML = `<strong>${data.username}</strong> enviou uma <a href="#map" onclick="setMapView(${data.latitude}, ${data.longitude}); return false;">localização</a>.`;
      L.marker([data.latitude, data.longitude], {icon: customIcon}).addTo(map)
        .bindPopup(`${data.username} está aqui.`);
    } else {
      msgElem.innerHTML = `<strong>${data.username}:</strong> ${data.content}`;
    }
    messagesDiv.appendChild(msgElem);
    lastMessageId = data.id;
  });

  messageForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const content = messageInput.value;
    if (content.trim() === '') return;
    socket.emit('send_message', { content: content, is_location: false });
    messageInput.value = '';
  });

  map.on('click', function(e) {
    pendingLocation = e.latlng;
    locationPopup.querySelector('p').textContent = "Deseja enviar esta localização?";
    locationPopup.classList.add('show');
    locationPopup.style.display = 'block';
  });

  popupYes.addEventListener('click', function() {
    if (pendingLocation) {
      socket.emit('send_message', { is_location: true, latitude: pendingLocation.lat, longitude: pendingLocation.lng });
      pendingLocation = null;
      locationPopup.classList.remove('show');
      setTimeout(() => { locationPopup.style.display = 'none'; }, 300);
    }
  });

  popupNo.addEventListener('click', function() {
    pendingLocation = null;
    locationPopup.classList.remove('show');
    setTimeout(() => { locationPopup.style.display = 'none'; }, 300);
  });

  setInterval(function() {
    fetch('/get_users')
      .then(response => response.json())
      .then(data => {
        let newUsers = data.users;
        if (JSON.stringify(newUsers) !== JSON.stringify(currentUsers)) {
          currentUsers = newUsers;
          usersList.innerHTML = '';
          newUsers.forEach(user => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            li.innerHTML = `<i class="fas fa-user-circle"></i><span>${user}</span>`;
            usersList.appendChild(li);
          });
        }
      });
  }, 5000);

  if (clearMessagesBtn) {
    clearMessagesBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm("Deseja limpar todas as mensagens?")) {
        fetch('/clear_messages', { method: 'POST' })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'sucesso') {
              messagesDiv.innerHTML = '';
            } else {
              alert("Erro ao limpar mensagens: " + data.message);
            }
          });
      }
    });
  }
});
function setMapView(lat, lng) {
  window.map.setView([lat, lng], 18);
  return false;
}
