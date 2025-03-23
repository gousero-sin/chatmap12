function showLoading() {
  const container = document.getElementById('loading-container');
  if (!container) return;

  container.innerHTML = '';
  fetch('/get_loading_videos')
    .then(response => response.json())
    .then(data => {
      if (data && data.videos && data.videos.length > 0) {
        const videos = data.videos;
        const randomIndex = Math.floor(Math.random() * videos.length);
        const chosenVideo = videos[randomIndex];
        const video = document.createElement('video');

        video.autoplay = true;
        video.muted = true;
        video.loop = false;
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.src = '/static/videos/loading/' + chosenVideo;

        // Debug para inspecionar se o duration está correto
        video.addEventListener('timeupdate', () => {
          console.log('VideoTime:', video.currentTime, ' / ', video.duration);
        });

        // Se o navegador reportar "ended", finalizamos
        video.addEventListener('ended', () => {
          console.log('ENDED event disparou');
          hideLoading();
        });

        // Fallback: se chegar muito perto do final
        video.addEventListener('timeupdate', function checkTime() {
          if (video.duration && video.currentTime >= video.duration - 0.5) {
            console.log('timeupdate: Atingiu (duration - 0.5)');
            hideLoading();
            video.pause();
            video.removeEventListener('timeupdate', checkTime);
          }
        });

        // Tentar forçar um play (se o navegador permitir)
        video.addEventListener('loadedmetadata', () => {
          console.log('loadedmetadata. duration =', video.duration);
          video.play().catch(err => console.warn('Falha ao dar play automático:', err));
        });

        container.appendChild(video);
        container.style.display = 'flex';
      } else {
        container.style.display = 'none';
      }
    })
    .catch(error => {
      console.error('Erro ao obter vídeos de loading:', error);
      container.style.display = 'none';
    });
}

function hideLoading() {
  const container = document.getElementById('loading-container');
  if (container) {
    container.style.display = 'none';
  }
}
