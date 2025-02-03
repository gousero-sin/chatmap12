document.addEventListener('DOMContentLoaded', function() {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesDiv = document.getElementById('messages');
    const usersList = document.getElementById('users-list');
    const usersLoading = document.getElementById('users-loading');
    const locationPopup = document.getElementById('location-popup');
    const popupYes = document.getElementById('popup-yes');
    const popupNo = document.getElementById('popup-no');
    let pendingLocation = null;
    let lastMessageId = 0;
    let currentUsers = [];
  
    // Cria um marker customizado usando Font Awesome
    const customIcon = L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color:#d32f2f;font-size:28px;"></i>',
      className: 'custom-div-icon',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  
    // Inicializa o Socket.IO
    const socket = io();
  
    // Inicializa o mapa e expõe-o globalmente para uso do hyperlink
    const map = L.map('map').setView([0, 0], 2);
    window.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  
    // Recebe mensagens em tempo real
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
  
    // Atualiza a lista de usuários apenas quando houver mudanças
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
  });
  
  // Função global para atualizar a visualização do mapa via hyperlink
  function setMapView(lat, lng) {
    window.map.setView([lat, lng], 18);
    return false;
  }
  