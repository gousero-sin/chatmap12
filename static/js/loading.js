// static/js/loading.js
function showLoading(text = "Carregando...") {
  const container = document.getElementById('loading-container');
  if (container) {
    container.querySelector('.loading-text').textContent = text;
    container.style.display = 'flex';
  }
}
function hideLoading() {
  const container = document.getElementById('loading-container');
  if (container) {
    container.style.display = 'none';
  }
}
