// src/pages/ChatsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../axiosInstance';
import { Client } from '@stomp/stompjs';
import '../App.css';

const WS_URL = 'ws://localhost:8080/ws';
const RECONNECT_DELAY = 5000;

const ChatsPage = () => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const stompClientRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Загрузка текущего пользователя
  useEffect(() => {
    console.log('[Init] Загрузка информации о пользователе');
    axios.post('/auth/who-am-i')
      .then(res => {
        console.log('[User] Пользователь получен:', res.data.username);
        setCurrentUser(res.data);
      })
      .catch(err => console.error('[User] Ошибка:', err));
  }, []);

  // Загрузка списка чатов
  useEffect(() => {
    console.log('[Chats] Загрузка списка чатов');
    axios.get('/api/chat-rooms/my')
      .then(res => {
        console.log('[Chats] Получено чатов:', res.data.length);
        setChats(res.data);
      })
      .catch(err => console.error('[Chats] Ошибка:', err));
  }, []);

  // Загрузка сообщений при выборе чата
  useEffect(() => {
    if (!selectedChat) {
      console.log('[Messages] Чат не выбран');
      return;
    }
    console.log(`[Messages] Загрузка истории для чата ${selectedChat.id}`);
    axios.get(`/api/chat-messages/${selectedChat.id}?page=0&size=50&sort=timestamp,desc`)
      .then(res => {
        console.log(`[Messages] Получено ${res.data.content.length} сообщений`);
        setMessages(res.data.content);
      })
      .catch(err => console.error('[Messages] Ошибка:', err));
  }, [selectedChat]);

  // WebSocket подключение
  useEffect(() => {
    if (!currentUser) {
      console.log('[WS] Пропуск подключения - пользователь не загружен');
      return;
    }

    console.log(`[WS] Инициализация подключения для ${currentUser.username}`);
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      debug: (str) => console.debug('[WS Debug]', str),
      reconnectDelay: RECONNECT_DELAY,
      onConnect: () => {
        console.log('[WS] Подключение установлено');
        
        // Подписка на уведомления о новых чатах
        client.subscribe(
          `/user/${currentUser.username}/queue/chat-creations`,
          (msg) => {
            console.log('[WS] Новый чат:', msg.body);
            const note = JSON.parse(msg.body);
            setChats(prev => [{ id: note.chatId, name: note.chatName }, ...prev]);
          }
        );

        // Регистрация подписки на сервере
        client.publish({
          destination: '/app/chat.subscribeToCreations',
          body: JSON.stringify({}),
        });
      },
      onDisconnect: () => console.log('[WS] Соединение закрыто'),
      onStompError: (frame) => console.error('[WS] STOMP Error:', frame.headers.message),
      onWebSocketError: (event) => console.error('[WS] Socket Error:', event),
    });

    stompClientRef.current = client;
    client.activate();

    return () => {
      console.log('[WS] Очистка WebSocket');
      client.deactivate();
    };
  }, [currentUser]);

  // Подписка на сообщения чата
  useEffect(() => {
    if (!stompClientRef.current?.connected || !selectedChat) {
      console.log('[Subscribe] Пропуск подписки:', {
        connected: stompClientRef.current?.connected,
        chat: selectedChat?.id
      });
      return;
    }

    console.log(`[Subscribe] Подписка на чат ${selectedChat.id}`);
    if (subscriptionRef.current) {
      console.log('[Subscribe] Отписка от предыдущего чата');
      subscriptionRef.current.unsubscribe();
    }

    const sub = stompClientRef.current.subscribe(
      `/topic/chat/${selectedChat.id}`,
      (message) => {
        const newMsg = JSON.parse(message.body);
        console.log('[WS] Новое сообщение:', newMsg.content);
        setMessages(prev => [newMsg, ...prev]);
      }
    );
    subscriptionRef.current = sub;

    return () => {
      if (subscriptionRef.current) {
        console.log('[Subscribe] Отписка при очистке');
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [selectedChat, stompClientRef.current?.connected]);

  // Отправка сообщения
  const handleSendMessage = e => {
    e.preventDefault();
    console.log('[Send] Попытка отправки:', {
      message: inputMessage,
      chat: selectedChat?.id,
      connected: stompClientRef.current?.connected
    });

    if (!inputMessage.trim() || !selectedChat || !stompClientRef.current?.connected) {
      console.warn('[Send] Отправка невозможна');
      return;
    }

    const msg = {
      content: inputMessage,
      chatId: selectedChat.id,
      fileUrl: null
    };

    try {
      stompClientRef.current.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(msg),
      });
      console.log('[Send] Сообщение отправлено');
    } catch (error) {
      console.error('[Send] Ошибка:', error);
    }
    setInputMessage('');
  };

  // Создание нового чата
  const createNewChat = () => {
    console.log('[Chat] Создание нового чата');
    axios.post('/api/chat-rooms/chat-ai', {})
      .then(res => {
        const newChat = { id: res.data.id, name: res.data.name || 'Новый Чат' };
        console.log('[Chat] Создан чат:', newChat);
        setChats(prev => [newChat, ...prev]);
        setSelectedChat(newChat);
      })
      .catch(err => console.error('[Chat] Ошибка:', err));
  };

  // Выход из системы
  const handleLogout = () => {
    console.log('[Auth] Выход из системы');
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>DeepSeek</h2>
          <button onClick={createNewChat} className="new-chat-button">
            + Новый чат
          </button>
          <button onClick={handleLogout} className="logout-button">
            Выйти
          </button>
        </div>
        <div className="chat-history">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
              onClick={() => setSelectedChat(chat)}
            >
              {chat.name}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <div className="messages-container">
          {messages.slice().reverse().map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.sender.username === currentUser?.username ? 'user' : 'ai'}`}
            >
              <div className="message-header">{msg.sender.username}</div>
              <div className="message-content">
                {msg.content}
                {msg.fileUrl && (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                  >
                    Прикреплённый файл
                  </a>
                )}
              </div>
              <div className="message-timestamp">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        {selectedChat && (
          <form onSubmit={handleSendMessage} className="input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Напишите сообщение..."
              className="message-input"
            />
            <button type="submit" className="send-button">
              Отправить
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChatsPage;