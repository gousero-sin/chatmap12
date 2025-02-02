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
  
    const map = L.map('map').setView([0, 0], 2);
    window.map = map; // Expor globalmente para uso no hyperlink
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  
    function fetchMessages() {
      fetch('/get_messages')
        .then(response => response.json())
        .then(data => {
          data.messages.forEach(msg => {
            if (msg.id > lastMessageId) {
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
            }
          });
        });
    }
  
    // Função global para ajustar a visualização do mapa
    window.setMapView = function(lat, lng) {
      map.setView([lat, lng], 18);
      return false;
    };
  
    function fetchUsers() {
      fetch('/get_users')
        .then(response => response.json())
        .then(data => {
          let newUsers = data.users;
          if (JSON.stringify(newUsers) !== JSON.stringify(currentUsers)) {
            currentUsers = newUsers;
            usersList.innerHTML = '';
            newUsers.forEach(user => {
              const li = document.createElement('li');
              li.classList.add('user-item', 'flick');
              li.innerHTML = `<i class="fas fa-user-circle"></i><span>${user}</span>`;
              usersList.appendChild(li);
            });
          }
        });
    }
  
    messageForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const content = messageInput.value;
      if (content.trim() === '') return;
      fetch('/send_message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ content: content, is_location: false })
      }).then(() => {
        messageInput.value = '';
        fetchMessages();
      });
    });
  
    map.on('click', function(e) {
      pendingLocation = e.latlng;
      locationPopup.querySelector('p').textContent = "Deseja enviar esta localização?";
      locationPopup.classList.add('show');
      locationPopup.style.display = 'block';
    });
  
    popupYes.addEventListener('click', function() {
      if (pendingLocation) {
        fetch('/send_message', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ is_location: true, latitude: pendingLocation.lat, longitude: pendingLocation.lng })
        }).then(() => {
          fetchMessages();
          pendingLocation = null;
          locationPopup.classList.remove('show');
          setTimeout(() => { locationPopup.style.display = 'none'; }, 300);
        });
      }
    });
  
    popupNo.addEventListener('click', function() {
      pendingLocation = null;
      locationPopup.classList.remove('show');
      setTimeout(() => { locationPopup.style.display = 'none'; }, 300);
    });
  
    setInterval(fetchMessages, 1000);
    setInterval(fetchUsers, 5000);
  });
  