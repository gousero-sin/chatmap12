from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from flask_socketio import SocketIO, emit
from datetime import datetime, timedelta
import json

from models import db, User, Message

app = Flask(__name__)
app.config['SECRET_KEY'] = 'sua_chave_secreta_aqui'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
bcrypt = Bcrypt(app)
socketio = SocketIO(app)

with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    error = None
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password')
        if User.query.filter_by(username=username).first():
            error = 'Usuário já existe.'
        else:
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            user = User(username=username, password=hashed_password)
            db.session.add(user)
            db.session.commit()
            login_user(user)
            return redirect(url_for('chat'))
    return render_template('register.html', error=error)

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            user.last_active = datetime.utcnow()
            db.session.commit()
            return redirect(url_for('chat'))
        else:
            error = 'Credenciais inválidas.'
    return render_template('login.html', error=error)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/chat')
@login_required
def chat():
    return render_template('chat.html')

@app.route('/get_messages')
@login_required
def get_messages():
    messages_query = Message.query.order_by(Message.timestamp.asc()).limit(50)
    messages = []
    for msg in messages_query:
        messages.append({
            'id': msg.id,
            'username': msg.username,
            'content': msg.content,
            'timestamp': msg.timestamp.strftime('%H:%M:%S'),
            'is_location': msg.is_location,
            'latitude': msg.latitude,
            'longitude': msg.longitude
        })
    return jsonify({'messages': messages})

@app.route('/get_users')
@login_required
def get_users():
    limite = datetime.utcnow() - timedelta(seconds=60)
    users = User.query.filter(User.last_active >= limite).all()
    users_list = [user.username for user in users]
    return jsonify({'users': users_list})

@app.before_request
def update_last_active():
    if current_user.is_authenticated:
        current_user.last_active = datetime.utcnow()
        db.session.commit()

@socketio.on('send_message')
def handle_send_message(data):
    if current_user.is_authenticated:
        if data.get('is_location'):
            message = Message(
                username=current_user.username,
                content=None,
                is_location=True,
                latitude=data.get('latitude'),
                longitude=data.get('longitude')
            )
        else:
            message = Message(
                username=current_user.username,
                content=data.get('content'),
                is_location=False
            )
        db.session.add(message)
        db.session.commit()
        emit('new_message', {
            'id': message.id,
            'username': message.username,
            'content': message.content,
            'timestamp': message.timestamp.strftime('%H:%M:%S'),
            'is_location': message.is_location,
            'latitude': message.latitude,
            'longitude': message.longitude
        }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True, ssl_context='adhoc')

