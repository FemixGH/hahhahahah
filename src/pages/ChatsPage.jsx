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
  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  const stompClientRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Helper function to truncate chat name
  const truncateChatName = (name) => {
    if (!name) return '';
    const maxLength = 15;
    return name.length > maxLength 
      ? name.substring(0, maxLength) + '...' 
      : name;
  };

  // Загрузка информации о пользователе
  useEffect(() => {
    axios.post('/auth/who-am-i')
      .then(res => setCurrentUser(res.data))
      .catch(err => console.error('[User] Ошибка:', err));
  }, []);

  // Загрузка списка чатов и их имён (первых сообщений)
  useEffect(() => {
    const fetchChats = async () => {
      setIsChatsLoading(true);
      try {
        // Получаем список чатов
        const res = await axios.get('/api/chat-rooms/my');
        const list = res.data.slice().reverse().map(chat => ({
          ...chat,
          isEmpty: !chat.lastMessage,
          // временное имя, пока не подгрузили первое сообщение
          name: chat.lastMessage ? truncateChatName(chat.lastMessage.content) : 'Новый чат'
        }));

        // Подгружаем первые сообщения для корректных имён
        const withNames = await Promise.all(
          list.map(async chat => {
            try {
              const msgRes = await axios.get(
                `/api/chat-messages/${chat.id}?page=0&size=1&sort=timestamp,asc`
              );
              const msgs = msgRes.data.content;
              if (msgs.length > 0) {
                return {
                  ...chat,
                  name: truncateChatName(msgs[0].content),
                  isEmpty: false
                };
              }
            } catch (err) {
              console.warn('[Chat Name] Не удалось подгрузить первое сообщение для чата', chat.id, err);
            }
            return chat;
          })
        );

        setChats(withNames);
        // Выбираем первый чат
        if (withNames.length > 0) {
          setSelectedChat(withNames[0]);
        } else {
          setSelectedChat(null);
          setMessages([]);
        }
      } catch (err) {
        console.error('[Chats] Ошибка загрузки:', err);
      } finally {
        setIsChatsLoading(false);
      }
    };
    fetchChats();
  }, []);

  // Загрузка сообщений и обновление названия чата
  useEffect(() => {
    setInputMessage('');

    if (!selectedChat) {
      setMessages([]);
      return;
    }

    axios
      .get(`/api/chat-messages/${selectedChat.id}?page=0&size=50&sort=timestamp,desc`)
      .then(res => {
        const msgs = res.data.content;
        setMessages(msgs);

        // Обновляем название, если чат был пуст
        if (selectedChat.isEmpty && msgs.length > 0) {
          const firstMessage = msgs[msgs.length - 1];
          setChats(prev => prev.map(chat =>
            chat.id === selectedChat.id
              ? { ...chat, name: truncateChatName(firstMessage.content), isEmpty: false }
              : chat
          ));
        }
      })
      .catch(err => console.error('[Messages] Ошибка:', err));
  }, [selectedChat]);

  // WebSocket подключение
  useEffect(() => {
    if (!currentUser) return;

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      reconnectDelay: RECONNECT_DELAY,
      onConnect: () => {
        client.subscribe(
          `/user/${currentUser.username}/queue/chat-creations`,
          msg => {
            const note = JSON.parse(msg.body);
            setChats(prev => {
              if (prev.find(c => c.id === note.chatId)) return prev;
              return [{ id: note.chatId, name: 'Новый чат', isEmpty: true }, ...prev];
            });
          }
        );
        client.publish({ destination: '/app/chat.subscribeToCreations', body: JSON.stringify({}) });
      }
    });

    stompClientRef.current = client;
    client.activate();
    return () => client.deactivate();
  }, [currentUser]);

  // Подписка на сообщения чата
  useEffect(() => {
    const client = stompClientRef.current;
    if (!client?.connected || !selectedChat) return;

    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = client.subscribe(
      `/topic/chat/${selectedChat.id}`,
      msg => {
        const newMsg = JSON.parse(msg.body);
        setMessages(prev => [newMsg, ...prev]);
        setChats(prev => prev.map(chat =>
          chat.id === selectedChat.id
            ? { ...chat, name: chat.isEmpty ? truncateChatName(newMsg.content) : chat.name, isEmpty: false }
            : chat
        ));
      }
    );

    return () => subscriptionRef.current?.unsubscribe();
  }, [selectedChat, stompClientRef.current?.connected]);

  // Отправка сообщения
  const handleSendMessage = e => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChat || !stompClientRef.current?.connected) return;

    stompClientRef.current.publish({
      destination: '/app/chat.sendMessage',
      body: JSON.stringify({ content: inputMessage, chatId: selectedChat.id, fileUrl: null })
    });
    setInputMessage('');
  };

  // Создание нового чата
  const createNewChat = async () => {
    const existingEmpty = chats.find(c => c.isEmpty);
    if (existingEmpty) return setSelectedChat(existingEmpty);
    try {
      await axios.post('/api/chat-rooms/chat-ai', {});
    } catch (err) {
      console.error('[Chat] Ошибка создания:', err);
    }
  };

  // Выход из системы
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Твой ФФ</h2>
          {!isChatsLoading && chats.length > 0 && (
            <button onClick={createNewChat} className="new-chat-button" disabled={chats.some(chat => chat.isEmpty)}>
              + Новый чат
            </button>
          )}
          <button onClick={handleLogout} className="logout-button">Выйти</button>
        </div>
        <div className="chat-history">
          {chats.map(chat => (
            <div key={chat.id} className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`} onClick={() => setSelectedChat(chat)}>
              {chat.name}
              {chat.isEmpty && <span className="empty-indicator"> •</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="chat-main">
        {isChatsLoading ? <div className="loading">Загрузка чатов...</div> : chats.length === 0 ? (
          <div className="first-chat-overlay" onClick={createNewChat}>
            <div className="overlay-content">
              <h3>Добро пожаловать 👋</h3>
              <p>У вас ещё нет ни одного чата. Нажмите ниже, чтобы создать первый.</p>
              <button className="create-first-chat-button">Создать первый чат</button>
            </div>
          </div>
        ) : (
          <>
            <div className="messages-container">
              {messages.slice().reverse().map((msg, i) => (
                <div key={i} className={`message ${msg.sender.username === currentUser?.username ? 'user' : 'ai'}`}>
                  <div className="message-content">
                    {msg.content}
                    {msg.fileUrl && <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="file-link">Прикреплённый файл</a>}
                  </div>
                </div>
              ))}
            </div>
            {selectedChat && (
              <form onSubmit={handleSendMessage} className="input-container">
                <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} placeholder="Напишите сообщение..." className="message-input" />
                <button type="submit" className="send-button">Отправить</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatsPage;
