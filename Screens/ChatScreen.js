import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Image, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../Firebase/firebase'; // ...existing firebase config...
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { createNotification, markNotificationAsRead } from '../utils/firebaseHelper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUnreadMessageCounts } from '../utils/firebaseHelper'; // Ensure these are imported

const ChatScreen = ({ route, navigation }) => {
    const { userId: partnerId, userName, avatarUrl, lastLogin, lastMessageTime } = route.params;
    const [currentUserId, setCurrentUserId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [partnerStatus, setPartnerStatus] = useState({ online: false, lastSeen: lastMessageTime });
    const [isLoading, setIsLoading] = useState(true);
    const [unreadMessages, setUnreadMessages] = useState(false); // Track if there are unread messages
    const flatListRef = useRef(null);

    // Get current user ID from storage
    useEffect(() => {
        AsyncStorage.getItem('userId').then(setCurrentUserId);
    }, []);

    // Compute chat room id using both user ids (sorted to ensure uniqueness)
    const chatRoomId = currentUserId ? [currentUserId, partnerId].sort().join('_') : null;

    // Subscribe to chat messages
    useEffect(() => {
        if (!chatRoomId) return;
        const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, snapshot => {
            const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(newMessages);

            // Check if there are unread messages
            const hasUnread = newMessages.some(
                (message) => message.sender === partnerId && !message.readBy?.includes(currentUserId)
            );
            setUnreadMessages(hasUnread);

            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [chatRoomId, currentUserId, partnerId]);

    // Update current user's status when entering/leaving chat
    useEffect(() => {
        if (!currentUserId) return;

        const updateUserStatus = async (isOnline) => {
            const userRef = doc(db, 'users', currentUserId);
            await updateDoc(userRef, {
                online: isOnline,
                lastSeen: serverTimestamp()
            });
        };

        // Set user as online when entering chat
        updateUserStatus(true);

        // Set user as offline when leaving chat
        return () => {
            updateUserStatus(false);
        };
    }, [currentUserId]);

    // Listen to partner's status changes
    useEffect(() => {
        if (!partnerId) return;

        const partnerRef = doc(db, 'users', partnerId);
        const unsubscribe = onSnapshot(partnerRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setPartnerStatus({
                    online: data.online || false,
                    lastSeen: data.lastSeen ? new Date(data.lastSeen.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : lastMessageTime
                });
            }
        });

        return () => unsubscribe();
    }, [partnerId]);

    // Mark messages as read when chat is opened
    useEffect(() => {
        const markAsRead = async () => {
            if (currentUserId && partnerId) {
                await markNotificationAsRead(partnerId, currentUserId);
                setUnreadMessages(false); // Clear the "New" badge
            }
        };
        markAsRead();
    }, [currentUserId, partnerId]);

    const getStatusText = () => {
        if (partnerStatus.online) {
            return 'Online';
        }
        return `Last seen at ${partnerStatus.lastSeen}`;
    };

    const sendMessage = async () => {
        if (!input.trim() || !chatRoomId) return;
        const message = input.trim();
        setInput(''); // Clear text field immediately after reading the input

        try {
            const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');

            // First, check if the partner is offline
            const partnerRef = doc(db, 'users', partnerId);
            const partnerDoc = await getDoc(partnerRef);
            const isPartnerOffline = !partnerDoc.data()?.online;

            // Send message
            await addDoc(messagesRef, {
                text: message,
                sender: currentUserId,
                timestamp: serverTimestamp()
            });

            // If partner is offline, create notification
            if (isPartnerOffline) {
                await createNotification(currentUserId, partnerId, message);
            }

            // Update user status
            await updateDoc(doc(db, 'users', currentUserId), {
                online: true,
                lastSeen: serverTimestamp()
            });

            flatListRef.current?.scrollToEnd({ animated: true });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp.seconds * 1000);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const renderMessage = ({ item }) => (
        <View style={[styles.messageContainer, item.sender === currentUserId ? styles.myMessage : styles.theirMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
            {item.timestamp && (
                <Text style={styles.timestamp}>
                    {formatDate(item.timestamp)}
                </Text>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Image source={{ uri: avatarUrl }} style={styles.partnerAvatar} />
                    <View style={styles.headerInfo}>
                        <Text style={styles.partnerName}>{userName}</Text>
                        <Text style={[styles.lastOnline, partnerStatus.online && styles.onlineText]}>
                            {getStatusText()}
                        </Text>
                    </View>
                    {unreadMessages && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>New</Text>
                        </View>
                    )}
                </View>

                {/* Messages */}
                <View style={styles.chatSection}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <LottieView
                                source={require('../assets/animations/loading.json')}
                                autoPlay
                                loop
                                style={styles.loadingAnimation}
                            />
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={(item) => item.id}
                            renderItem={renderMessage}
                            style={styles.messageList}
                            contentContainerStyle={styles.messageListContent}
                            onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: true })}
                        />
                    )}
                </View>

                {/* Input */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={styles.inputContainer}>
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            placeholder="Type a message..."
                            placeholderTextColor="#999"
                            style={styles.input}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
                            onPress={sendMessage}
                            disabled={!input.trim()}
                        >
                            <LinearGradient
                                colors={['#4a9eff', '#3b7fd1']}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Feather name="send" size={24} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </LinearGradient>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2f2f2f',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
        paddingTop: 20,
    },
    backButton: {
        padding: 10,
    },
    partnerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginLeft: 10,
        borderWidth: 2,
        borderColor: '#4a9eff'
    },
    headerInfo: {
        marginLeft: 15,
        flex: 1,
    },
    partnerName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    lastOnline: {
        color: '#b0b0b0',
        fontSize: 12,
    },
    onlineText: {
        color: '#4CAF50',
    },
    chatSection: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    messageList: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    messageListContent: {
        padding: 15,
    },
    messageContainer: {
        marginVertical: 5,
        padding: 12,
        borderRadius: 16,
        maxWidth: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    myMessage: {
        backgroundColor: '#4a9eff',
        alignSelf: 'flex-end',
        borderTopRightRadius: 4,
    },
    theirMessage: {
        backgroundColor: '#2f2f2f',
        alignSelf: 'flex-start',
        borderTopLeftRadius: 4,
    },
    messageText: {
        color: '#fff',
        fontSize: 16,
        lineHeight: 20,
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        color: 'rgba(255, 255, 255, 0.6)',
        alignSelf: 'flex-end',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#2f2f2f',
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    input: {
        flex: 1,
        backgroundColor: '#1C1C1C',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        color: '#fff',
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        width: 45,
        height: 45,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradientButton: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 23,
    },
    sendButtonDisabled: {
        backgroundColor: '#666',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingAnimation: {
        width: 100,
        height: 100,
    },
    newBadge: {
        backgroundColor: '#4a9eff',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 8,
    },
    newBadgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default ChatScreen;
