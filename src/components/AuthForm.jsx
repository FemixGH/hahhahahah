import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const AuthForm = ({ type }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const isLogin = type === 'login';

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = isLogin
        ? 'http://localhost:8080/api/auth/login'
        : 'http://localhost:8080/api/auth/register';

      const payload = isLogin
        ? { username, password }
        : { username, email, password };

      const response = await axios.post(url, payload);

      // Сохраняем JWT
      localStorage.setItem('token', response.data.token);

      // Переход на главную страницу
      navigate('/');
    } catch (error) {
      console.error('Auth error:', error.response?.data || error.message);
      alert('Ошибка авторизации/регистрации');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>{isLogin ? 'Авторизация' : 'Регистрация'}</h2>

      <input
        type="text"
        placeholder="Имя пользователя"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      {!isLogin && (
        <input
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      )}

      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button type="submit">{isLogin ? 'Войти' : 'Зарегистрироваться'}</button>

      {isLogin ? (
        <p>
          Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
        </p>
      ) : (
        <p>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      )}
    </form>
  );
};

export default AuthForm;
