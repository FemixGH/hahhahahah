import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8080/auth/sign-up', {
        username,
        email,
        password,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      navigate('/login'); // переход на страницу входа
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      setError(err.response?.data?.message || 'Ошибка регистрации');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-container">
        <h2 className="auth-title">Создание аккаунта</h2>
        <form onSubmit={handleRegister} className="auth-form">
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
            <label className="auth-label">Электронная почта</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            Зарегистрироваться
          </button>
        </form>

        <p className="auth-text">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="auth-link">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
