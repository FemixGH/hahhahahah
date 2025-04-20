import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8080/auth/sign-in', {
        username,
        password,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      const token = response.data.token;
      localStorage.setItem('token', token);
      navigate('/chats'); // переход на главную страницу с чатами
    } catch (err) {
      console.error('Ошибка авторизации:', err);
      setError(err.response?.data?.message || 'Неверные учетные данные');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-container">
        <h2 className="auth-title">Вход в систему</h2>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <label className="auth-label">Имя пользователя</label>
            <input
              className="auth-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label className="auth-label">Пароль</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-button">
            Войти
          </button>
        </form>

        <p className="auth-text">
          Ещё нет аккаунта?{' '}
          <Link to="/register" className="auth-link">
            Создайте аккаунт
          </Link>
        </p>
      </div>
    </div>
  );
};


export default LoginPage;
