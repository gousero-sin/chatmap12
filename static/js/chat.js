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
  let isRecording = false;
  let mediaRecorder;
  let audioChunks = [];
  let typingTimer;

  // Função de auto-scroll
  function autoScroll() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Função auxiliar para obter o nome do usuário atual
  function currentUserName() {
    return window.currentUsername || "Você";
  }

  // Ícone customizado para os marcadores do mapa
  const customIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color:#d32f2f;font-size:28px;"></i>',
    className: 'custom-div-icon',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });

  // Inicializa Socket.IO e mapa
  const socket = io();
  const map = L.map('map').setView([0, 0], 2);
  window.map = map;
  let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Dark mode toggle: altera também os tiles do mapa
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

  // Popup do menu de anexos/áudio com animações
  if (menuBtn && menuPopup) {
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (menuPopup.style.display === 'none' || menuPopup.style.display === '') {
        menuPopup.style.display = 'block';
        menuPopup.classList.remove('animate__bounceOutUp');
        menuPopup.classList.add('animate__animated', 'animate__bounceInDown');
      } else {
        menuPopup.classList.remove('animate__bounceInDown');
        menuPopup.classList.add('animate__animated', 'animate__bounceOutUp');
        setTimeout(() => { menuPopup.style.display = 'none'; }, 800);
      }
    });
    document.addEventListener('click', function(e) {
      if (!menuPopup.contains(e.target) && e.target !== menuBtn) {
        menuPopup.classList.remove('animate__bounceInDown');
        menuPopup.classList.add('animate__animated', 'animate__bounceOutUp');
        setTimeout(() => { menuPopup.style.display = 'none'; }, 800);
      }
    });
  }

  // Criação de um input file oculto para anexar arquivos
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  // Botão "Anexar Arquivo"
  const fileUploadBtn = menuPopup.querySelector('button.menu-option:nth-child(1)');
  if (fileUploadBtn) {
    fileUploadBtn.addEventListener('click', function(e) {
      e.preventDefault();
      fileInput.click();
    });
  }
  fileInput.addEventListener('change', function(e) {
    const file = fileInput.files[0];
    if (!file) return;
    const fileURL = URL.createObjectURL(file);
    const msg = {
      username: currentUserName(),
      content: `<a href="${fileURL}" target="_blank">Arquivo: ${file.name}</a>`,
      is_location: false
    };
    socket.emit('send_message', msg);
  });

  // Tratamento do botão "Gravar Áudio" com toggle e animação de pulse
  const audioRecordBtn = menuPopup.querySelector('button.menu-option:nth-child(2)');
  if (audioRecordBtn) {
    audioRecordBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!isRecording) {
        startAudioRecording();
        audioRecordBtn.innerHTML = '<i class="fas fa-stop"></i> Parar Gravação';
        audioRecordBtn.classList.add('animate__animated', 'animate__pulse');
      } else {
        stopAudioRecording();
        audioRecordBtn.innerHTML = '<i class="fas fa-microphone"></i> Gravar Áudio';
        audioRecordBtn.classList.add('animate__animated', 'animate__pulse');
      }
    });
  }
  
  function startAudioRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert('Gravação de áudio não é suportada nesse navegador.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        isRecording = true;
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.start();
        mediaRecorder.addEventListener('dataavailable', event => {
          audioChunks.push(event.data);
        });
      })
      .catch(err => {
        console.error('Erro ao acessar microfone:', err);
        alert('Não foi possível acessar o microfone.');
      });
  }
  
  function stopAudioRecording() {
    if (mediaRecorder && isRecording) {
      isRecording = false;
      mediaRecorder.stop();
      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(audioBlob);
        const msg = {
          username: currentUserName(),
          content: `<audio controls src="${audioURL}"></audio>`,
          is_location: false
        };
        socket.emit('send_message', msg);
      });
    }
  }

  // Carrega mensagens do servidor e faz auto-scroll
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
            L.marker([msg.latitude, msg.longitude], { icon: customIcon }).addTo(map)
              .bindPopup(`${msg.username} está aqui.`);
          } else {
            msgElem.innerHTML = `<strong>${msg.username}:</strong> ${msg.content}`;
          }
          messagesDiv.appendChild(msgElem);
          lastMessageId = msg.id;
        });
        autoScroll();
      });
  }
  
  // Recebe novas mensagens via Socket.IO e auto-scroll
  socket.on('new_message', function(data) {
    const msgElem = document.createElement('div');
    msgElem.classList.add('message');
    if (data.is_location) {
      msgElem.innerHTML = `<strong>${data.username}</strong> enviou uma <a href="#map" onclick="setMapView(${data.latitude}, ${data.longitude}); return false;">localização</a>.`;
      L.marker([data.latitude, data.longitude], { icon: customIcon }).addTo(map)
        .bindPopup(`${data.username} está aqui.`);
    } else {
      msgElem.innerHTML = `<strong>${data.username}:</strong> ${data.content}`;
    }
    messagesDiv.appendChild(msgElem);
    lastMessageId = data.id;
    autoScroll();
  });
  
  messageForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const content = messageInput.value;
    if (content.trim() === '') return;
    socket.emit('send_message', { content: content, is_location: false });
    messageInput.value = '';
    autoScroll();
  });
  
  // Envia localização ao clicar no mapa
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
  
  // Atualiza periodicamente a lista de usuários online
  setInterval(function() {
    fetch('/get_users')
      .then(response => response.json())
      .then(data => {
        const newUsers = data.users;
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
              lastMessageId = 0;
            } else {
              alert("Erro ao limpar mensagens: " + data.message);
            }
          })
          .catch(err => {
            console.error(err);
            alert("Erro ao limpar mensagens.");
          });
      }
    });
  }
  
  // Indicador de digitação
  messageInput.addEventListener('keyup', function() {
    socket.emit('typing', { username: currentUserName() });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('stop_typing', { username: currentUserName() });
    }, 1000);
  });
  
  socket.on('typing', function(data) {
    showTypingIndicator(data.username);
  });
  
  socket.on('stop_typing', function(data) {
    hideTypingIndicator(data.username);
  });
  
  function showTypingIndicator(username) {
    let indicator = document.getElementById('typing-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'typing-indicator';
      indicator.style.fontSize = '12px';
      indicator.style.fontStyle = 'italic';
      indicator.style.marginTop = '5px';
      messagesDiv.appendChild(indicator);
    }
    indicator.innerText = `${username} está digitando...`;
    setTimeout(() => {
      if (indicator.innerText === `${username} está digitando...`) {
        indicator.innerText = '';
      }
    }, 2000);
  }
  
  function hideTypingIndicator(username) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator && indicator.innerText.includes(username)) {
      indicator.innerText = '';
    }
  }
});
  
function setMapView(lat, lng) {
  window.map.setView([lat, lng], 18);
  return false;
}
