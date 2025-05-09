import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Image, FlatList, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData, getUsersData, getUnreadMessageCounts, getUnreadNotifications, markNotificationAsRead } from '../utils/firebaseHelper';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { BlurView } from 'expo-blur';
import { AntDesign } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../utils/firebaseHelper'; // ensure db is exported from firebaseHelper
import { SafeAreaView } from 'react-native-safe-area-context';

const ChatList = ({ navigation }) => {
    const [users, setUsers] = useState([]);
    const [profile, setProfile] = useState({
        name: '',
        avatarUrl: '',
        deletehash: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [overlayImageUrl, setOverlayImageUrl] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [newMessages, setNewMessages] = useState({});
    const [unreadNotifications, setUnreadNotifications] = useState({});

    const fetchData = useCallback(async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
                // Get profile and users data
                const [userData, usersData] = await Promise.all([
                    getUserData(userId),
                    getUsersData()
                ]);

                // Process user profile - use photoURL directly
                if (userData) {
                    setProfile({
                        name: userData.name,
                        avatarUrl: userData.photoURL,
                        bytescale: userData.bytescale
                    });
                }

                // Process users and get last message for each conversation
                const processedUsers = await Promise.all(usersData
                    .filter(user => user.id !== userId)
                    .map(async (user) => {
                        // Use photoURL directly from user data
                        const avatarUrl = user.photoURL || defaultPhotoUrl;

                        // Build chatRoomId and query the latest message (if any)
                        const chatRoomId = [userId, user.id].sort().join('_');
                        const lastMsgQuery = query(
                            collection(db, 'chatRooms', chatRoomId, 'messages'),
                            orderBy('timestamp', 'desc'),
                            limit(1)
                        );
                        const lastMsgSnapshot = await getDocs(lastMsgQuery);
                        let lastMessage = 'No messages yet';
                        let lastMessageTime = user.lastLogin
                            ? new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'No Login';
                        if (!lastMsgSnapshot.empty) {
                            const lastMsgData = lastMsgSnapshot.docs[0].data();
                            lastMessage = lastMsgData.text;
                            if (lastMsgData.timestamp) {
                                lastMessageTime = new Date(lastMsgData.timestamp.seconds * 1000)
                                    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }
                        }
                        return {
                            ...user,
                            avatarUrl,
                            lastMessage,
                            lastMessageTime,
                            isActive: user.lastLogin
                                ? ((new Date() - new Date(user.lastLogin)) < (5 * 60 * 1000))
                                : false
                        };
                    }));
                setUsers(processedUsers);

                // Fetch unread message counts
                const unreadCounts = await getUnreadMessageCounts(userId);
                setUnreadCounts(unreadCounts);

                // Fetch unread notifications
                const notifications = await getUnreadNotifications(userId);
                const notificationsBySender = {};
                notifications.forEach(notification => {
                    notificationsBySender[notification.senderId] = {
                        hasNew: true,
                        message: notification.messageText,
                        timestamp: notification.timestamp
                    };
                });
                setUnreadNotifications(notificationsBySender);

                // Set up listener for new messages in all chat rooms
                const chatRoomsRef = collection(db, 'chatRooms');
                const rooms = await getDocs(chatRoomsRef);

                rooms.docs.forEach(room => {
                    const roomId = room.id;
                    if (roomId.includes(userId)) {
                        const messagesRef = collection(db, 'chatRooms', roomId, 'messages');
                        const q = query(
                            messagesRef,
                            orderBy('timestamp', 'desc'),
                            limit(1)
                        );

                        // Listen for new messages
                        onSnapshot(q, (snapshot) => {
                            if (!snapshot.empty) {
                                const lastMessage = snapshot.docs[0].data();
                                const otherUserId = roomId.split('_').find(id => id !== userId);

                                // Check if message is new and unread
                                if (lastMessage.sender !== userId && !lastMessage.readBy?.includes(userId)) {
                                    setNewMessages(prev => ({
                                        ...prev,
                                        [otherUserId]: {
                                            hasNew: true,
                                            message: lastMessage.text,
                                            timestamp: lastMessage.timestamp
                                        }
                                    }));
                                }
                            }
                        });
                    }
                });

                // Set up real-time listener for notifications
                const notificationsRef = collection(db, 'notifications');
                const q = query(
                    notificationsRef,
                    where('receiverId', '==', userId),
                    where('isRead', '==', false)
                );

                onSnapshot(q, (snapshot) => {
                    const newNotifications = {};
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        newNotifications[data.senderId] = {
                            hasNew: true,
                            message: data.messageText,
                            timestamp: data.timestamp
                        };
                    });
                    setUnreadNotifications(newNotifications);
                });
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Single useEffect for initial data fetch
    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, [fetchData]);

    // Set up real-time listener for unread messages
    useEffect(() => {
        let unsubscribe;
        const setupRealtimeUpdates = async () => {
            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
                // Listen to unread messages for the current user where isRead is false.
                const messagesRef = collection(db, 'messages');
                const q = query(
                    messagesRef,
                    where('receiverId', '==', userId),
                    where('isRead', '==', false)
                );
                unsubscribe = onSnapshot(q, (snapshot) => {
                    const counts = {};
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const senderId = data.senderId;
                        // Update lastMessage as the latest message text
                        if (!counts[senderId]) {
                            counts[senderId] = { count: 0, lastMessage: data.text };
                        }
                        counts[senderId].count += 1;
                    });
                    setUnreadCounts(counts);
                });
            }
        };

        setupRealtimeUpdates();
        return () => {
            // Cleanup the listener on component unmount
            unsubscribe && unsubscribe();
        };
    }, []);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <LottieView
                    source={require('../assets/animations/loading.json')}
                    autoPlay
                    loop
                    style={styles.loadingAnimation}
                />
            </View>
        );
    }

    // Add this function for prefetching chat data
    const prefetchChatData = async (userId, partnerId) => {
        const chatRoomId = [userId, partnerId].sort().join('_');
        const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(20));
        await getDocs(q); // Prefetch latest 20 messages
    };

    // Modified renderItem to include prefetching
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.userContainer,
                !item.isActive && unreadNotifications[item.id]?.hasNew && styles.newMessageContainer
            ]}
            onPress={async () => {
                const userId = await AsyncStorage.getItem('userId');
                prefetchChatData(userId, item.id);

                // Clear notifications before navigation
                if (unreadNotifications[item.id]?.hasNew) {
                    await markNotificationAsRead(item.id, userId);
                    // Update local state to remove notification immediately
                    setUnreadNotifications(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], hasNew: false }
                    }));
                }

                navigation.navigate('ChatScreen', {
                    userId: item.id,
                    userName: item.name,
                    avatarUrl: item.avatarUrl,
                    lastLogin: item.lastMessageTime,
                    lastMessageTime: item.lastMessageTime
                });
            }}
        >
            <View style={styles.userAvatarContainer}>
                <TouchableOpacity onPress={() => setOverlayImageUrl(item.avatarUrl)}>
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                </TouchableOpacity>
                <View style={[styles.userOnlineDot, {
                    backgroundColor: item.isActive ? '#4CAF50' : '#999999'
                }]} />
            </View>
            <View style={styles.userInfo}>
                <View style={styles.userHeader}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.messageTime}>{item.lastMessageTime}</Text>
                </View>
                <View style={styles.messageContainer}>
                    <Text style={[
                        styles.lastMessage,
                        { flex: 1, marginRight: unreadNotifications[item.id]?.hasNew ? 8 : 0 }
                    ]} numberOfLines={1}>
                        {unreadNotifications[item.id]?.message || "No messages yet"}
                    </Text>
                    {!item.isActive && unreadNotifications[item.id]?.hasNew && (
                        <View style={styles.newMessageBadge}>
                            <Text style={styles.newMessageText}>New</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
                <View style={styles.headerBox}>
                    <View style={styles.headerContent}>
                        <View style={styles.profileInfo}>
                            <Image source={{ uri: profile.avatarUrl }} style={styles.profileAvatar} />
                            <View style={styles.profileTextContainer}>
                                <Text style={styles.profileName}>{profile.name}</Text>
                                <View style={styles.onlineIndicator}>
                                    <View style={styles.onlineDot} />
                                    <Text style={styles.onlineText}>Online</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.sectionTitle}>Members</Text>
                    <FlatList
                        data={users}
                        keyExtractor={(item) => item.email}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContent}
                    />
                </View>

                {overlayImageUrl && (
                    <BlurView intensity={100} tint="dark" style={styles.overlay}>
                        <TouchableOpacity style={styles.closeOverlay} onPress={() => setOverlayImageUrl(null)}>
                            <AntDesign name="closecircleo" size={32} color="white" />
                        </TouchableOpacity>
                        <View style={styles.overlayImageContainer}>
                            <Image source={{ uri: overlayImageUrl }} style={styles.overlayImage} />
                        </View>
                    </BlurView>
                )}
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
    headerBox: {
        backgroundColor: '#2f2f2f',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        padding: 30,
        paddingTop: 25,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: '#4a9eff',
    },
    profileTextContainer: {
        marginLeft: 12,
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
        textShadowColor: '#4a9eff',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
        marginRight: 6,
    },
    onlineText: {
        color: '#4CAF50',
        fontSize: 14,
    },
    contentContainer: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#4a9eff',
        marginBottom: 20,
        alignSelf: 'center',
        borderBottomWidth: 3,
        borderBottomColor: '#4a9eff',
        paddingBottom: 8,
    },
    userContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#242424',
        borderRadius: 20,
        marginBottom: 16,
        borderLeftWidth: 5,
        borderLeftColor: '#4a9eff',
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 6,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    userAvatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: '#4a9eff',
    },
    userOnlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#333333',
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    userHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#ffffff',
    },
    messageTime: {
        fontSize: 14,
        color: '#b0b0b0',
    },
    lastMessage: {
        fontSize: 16,
        color: '#b0b0b0',
        marginTop: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
    },
    loadingAnimation: {
        width: 200,
        height: 200,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayImageContainer: {
        width: 200,
        height: 200,
        borderRadius: 100,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#4a9eff',
    },
    overlayImage: {
        width: '100%',
        height: '100%',
    },
    closeOverlay: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
    },
    messageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    unreadBadge: {
        backgroundColor: '#4a9eff',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 8,
    },
    unreadCount: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    newMessageBadge: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#4a9eff',
    },
    newMessageText: {
        color: '#4a9eff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    newMessageContainer: {
        borderLeftColor: '#4a9eff',
        borderLeftWidth: 5,
        backgroundColor: '#1f1f1f', // Slightly lighter than normal background
    }
});

export default ChatList;