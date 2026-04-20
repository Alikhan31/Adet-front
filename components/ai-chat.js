import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';

const SERVER_URL = 'https://adet-server-production.up.railway.app/chat';

// Сюда передавай реальные привычки пользователя из твоего стейта
const USER_HABITS = ['медитация', 'спорт', 'чтение'];

export default function AiChat() {
  const [messages, setMessages] = useState([
    { id: '0', role: 'assistant', text: 'Привет! Я твой помощник в Adet. Как дела с привычками?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, habits: USER_HABITS })
      });
      const data = await response.json();
      const aiMsg = { id: (Date.now() + 1).toString(), role: 'assistant', text: data.reply };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant', text: 'Ошибка соединения, попробуй ещё раз.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
              {item.text}
            </Text>
          </View>
        )}
      />
      {loading && <ActivityIndicator style={{ marginBottom: 8 }} />}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Спроси что-нибудь..."
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#F1F1F1' },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: '#000' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 0.5, borderTopColor: '#ddd' },
  input: { flex: 1, backgroundColor: '#F1F1F1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 20 }
});