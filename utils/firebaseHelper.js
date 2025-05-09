import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where, orderBy, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
    // ...your firebase configuration...
    apiKey: "AIzaSyBmyk1CJ0Z1oTsxXL_kA67KHjz3F3AoSBc",
    authDomain: "roomc-83293.firebaseapp.com",
    projectId: "roomc-83293",
    storageBucket: "roomc-83293.appspot.com", // Modified this line
    messagingSenderId: "756629527166",
    appId: "1:756629527166:web:25f03678f866e6a593162f"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
const storage = getStorage(app);

export const storeUserData = async (userId, userData) => {
    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            ...userData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error('Detailed Firestore error:', error);
        throw new Error(`Database update failed: ${error.message}`);
    }
};

export const getUserData = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw new Error('Failed to fetch user data');
    }
};

export const getUsersData = async () => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching users data:', error);
        throw new Error('Failed to fetch users data');
    }
};

export const deleteUserData = async (userId) => {
    try {
        // Delete user document
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);

        // Delete user's chat messages
        const chatRoomsRef = collection(db, 'chatRooms');
        const chatRoomsSnapshot = await getDocs(chatRoomsRef);
        chatRoomsSnapshot.forEach(async (chatRoom) => {
            if (chatRoom.id.includes(userId)) {
                const messagesRef = collection(db, 'chatRooms', chatRoom.id, 'messages');
                const messagesSnapshot = await getDocs(messagesRef);
                messagesSnapshot.forEach(async (message) => {
                    await deleteDoc(message.ref);
                });
                await deleteDoc(chatRoom.ref);
            }
        });

        console.log(`User data for ${userId} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting user data:', error);
        throw new Error('Failed to delete user data');
    }
};

export const getUnreadMessageCounts = async (userId) => {
    try {
        const chatRoomsRef = collection(db, 'chatRooms');
        const counts = {};

        const chatRoomsSnapshot = await getDocs(chatRoomsRef);

        for (const room of chatRoomsSnapshot.docs) {
            const roomId = room.id;
            if (roomId.includes(userId)) {
                const messagesRef = collection(db, 'chatRooms', roomId, 'messages');
                const q = query(
                    messagesRef,
                    orderBy('timestamp', 'desc')
                );

                const messagesSnapshot = await getDocs(q);
                const otherUserId = roomId.split('_').find(id => id !== userId);

                // Get unread messages count
                const unreadMessages = messagesSnapshot.docs.filter(
                    doc => !doc.data().readBy?.includes(userId)
                );

                if (messagesSnapshot.docs.length > 0) {
                    const lastMessage = messagesSnapshot.docs[0].data();
                    counts[otherUserId] = {
                        count: unreadMessages.length,
                        lastMessage: lastMessage.text || '',
                        timestamp: lastMessage.timestamp
                    };
                } else {
                    counts[otherUserId] = {
                        count: 0,
                        lastMessage: '',
                        timestamp: null
                    };
                }
            }
        }

        return counts;
    } catch (error) {
        console.error('Error getting unread counts:', error);
        return {};
    }
};

// Mark messages as read
export const markMessagesAsRead = async (chatRoomId, userId) => {
    try {
        const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
        const q = query(
            messagesRef,
            where('sender', '!=', userId),
            where('readBy', 'not-in', [userId])
        );

        const unreadSnapshot = await getDocs(q);

        const batch = db.batch();
        unreadSnapshot.docs.forEach((doc) => {
            const messageRef = doc.ref;
            batch.update(messageRef, {
                readBy: [...(doc.data().readBy || []), userId]
            });
        });

        await batch.commit();
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
};

export const uploadProfilePhoto = async (uri, userId) => {
    try {
        const storageRef = ref(storage, `profilePhotos/${userId}.jpg`);
        const img = await fetch(uri);
        const bytes = await img.blob();
        await uploadBytes(storageRef, bytes);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Error uploading profile photo:", error);
        throw error;
    }
};

// Add these new functions
export const createNotification = async (senderId, receiverId, messageText) => {
    try {
        const notificationRef = collection(db, 'notifications');
        await addDoc(notificationRef, {
            senderId,
            receiverId,
            messageText,
            timestamp: serverTimestamp(),
            isRead: false,
            wasOffline: true
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

export const markNotificationAsRead = async (senderId, receiverId) => {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('senderId', '==', senderId),
            where('receiverId', '==', receiverId),
            where('isRead', '==', false)
        );

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                isRead: true,
                readAt: serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
};

export const getUnreadNotifications = async (userId) => {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('receiverId', '==', userId),
            where('isRead', '==', false),
            where('wasOffline', '==', true)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting unread notifications:', error);
        return [];
    }
};


