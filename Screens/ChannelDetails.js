import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc, arrayRemove, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseHelper';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';

const ChannelDetails = ({ route, navigation }) => {
    const { channelName, channelId } = route.params || {}; // Handle undefined params
    const [members, setMembers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null); // Current user details
    const [selectedImage, setSelectedImage] = useState(null); // State to track the selected profile picture
    const [channelCode, setChannelCode] = useState(''); // Channel code
    const [unreadNotifications, setUnreadNotifications] = useState({}); // Track unread notifications
    const [isLoading, setIsLoading] = useState(false); // Track loading state for "Leave Channel"

    useEffect(() => {
        if (!channelId || !channelName) {
            Alert.alert('Error', 'Channel details are missing.');
            navigation.navigate('RoomCreation'); // Navigate back to RoomCreation if params are missing
            return;
        }

        const fetchMembers = async () => {
            try {
                // Get the current user ID
                const userId = await AsyncStorage.getItem('userId');

                // Fetch the channel document
                const channelDocRef = doc(db, 'channels', channelId);
                const channelDoc = await getDoc(channelDocRef);

                if (channelDoc.exists()) {
                    const channelData = channelDoc.data();
                    setChannelCode(channelData.code); // Set the channel code

                    // Fetch members with lastSeen status
                    const membersWithLastSeen = await Promise.all(
                        (channelData.members || []).map(async (member) => {
                            const userDoc = await getDoc(doc(db, 'users', member.id));
                            const userData = userDoc.exists() ? userDoc.data() : {};
                            return {
                                ...member,
                                lastSeen: userData.lastSeen
                                    ? new Date(userData.lastSeen.seconds * 1000).toLocaleString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })
                                    : 'No recent activity',
                                online: userData.online || false,
                            };
                        })
                    );

                    setMembers(membersWithLastSeen);

                    // Fetch current user details
                    const currentUser = membersWithLastSeen.find((member) => member.id === userId);
                    setCurrentUser(currentUser);
                } else {
                    Alert.alert('Error', 'Channel not found.');
                    navigation.navigate('RoomCreation');
                }
            } catch (error) {
                console.error('Error fetching members:', error);
                Alert.alert('Error', 'Failed to fetch channel members.');
                navigation.navigate('RoomCreation');
            }
        };

        fetchMembers();
    }, [channelId, channelName]);

    useEffect(() => {
        // Store channel state in AsyncStorage when entering the channel
        const storeChannelState = async () => {
            await AsyncStorage.setItem('channelId', channelId);
            await AsyncStorage.setItem('channelName', channelName);
        };
        storeChannelState();
    }, [channelId, channelName]);

    useEffect(() => {
        const fetchUnreadNotifications = async () => {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) return;

            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('receiverId', '==', userId),
                where('isRead', '==', false)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newNotifications = {};
                snapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    newNotifications[data.senderId] = true; // Mark senderId as having unread messages
                });
                setUnreadNotifications(newNotifications);
            });

            return () => unsubscribe();
        };

        fetchUnreadNotifications();
    }, []);

    const handleLeaveChannel = async () => {
        Alert.alert(
            'Leave Channel',
            'Are you sure you want to leave this channel?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true); // Show loading animation
                        try {
                            // Get the current user ID
                            const userId = await AsyncStorage.getItem('userId');

                            // Remove the user from the channel
                            const channelDocRef = doc(db, 'channels', channelId);
                            const userDoc = await getDoc(doc(db, 'users', userId));
                            const userData = userDoc.data();

                            await updateDoc(channelDocRef, {
                                members: arrayRemove({
                                    id: userId,
                                    name: userData.name,
                                    photoURL: userData.photoURL,
                                }),
                            });

                            // Clear channel state from AsyncStorage
                            await AsyncStorage.removeItem('channelId');
                            await AsyncStorage.removeItem('channelName');

                            // Navigate back to RoomCreation
                            navigation.navigate('RoomCreation');
                        } catch (error) {
                            console.error('Error leaving channel:', error);
                            Alert.alert('Error', 'Failed to leave the channel. Please try again.');
                        } finally {
                            setIsLoading(false); // Hide loading animation
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }) => {
        // Exclude the current user from the list
        if (item.id === currentUser?.id) return null;

        return (
            <View style={styles.memberContainer}>
                <TouchableOpacity onPress={() => setSelectedImage(item.photoURL)}>
                    <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                </TouchableOpacity>
                <View style={styles.memberInfo}>
                    <TouchableOpacity onPress={() => navigation.navigate('ChatScreen', { userId: item.id, userName: item.name, avatarUrl: item.photoURL })}>
                        <Text style={styles.memberName}>{item.name}</Text>
                    </TouchableOpacity>
                    <Text style={styles.memberStatus}>
                        {item.online ? 'Online' : `Last seen: ${item.lastSeen}`}
                    </Text>
                </View>
                {unreadNotifications[item.id] && (
                    <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                    </View>
                )}
                <View style={[styles.userOnlineDot, { backgroundColor: item.online ? '#4CAF50' : '#999999' }]} />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Image source={{ uri: currentUser?.photoURL }} style={styles.currentUserAvatar} />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.channelName}>{channelName}</Text>
                            {currentUser && (
                                <Text style={styles.currentUserInfo}>
                                    {currentUser.name} | Code: {channelCode}
                                </Text>
                            )}
                        </View>
                    </View>
                    <Menu>
                        <MenuTrigger>
                            <Feather name="more-vertical" size={24} color="white" />
                        </MenuTrigger>
                        <MenuOptions customStyles={menuCustomStyles}>
                            <MenuOption onSelect={handleLeaveChannel}>
                                <Text style={styles.menuOption}>Leave Channel</Text>
                            </MenuOption>
                        </MenuOptions>
                    </Menu>
                </View>
                <FlatList
                    data={members}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                {/* Profile Picture Modal */}
                {selectedImage && (
                    <BlurView intensity={100} tint="dark" style={styles.blurOverlay}>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
                            <Feather name="x" size={28} color="white" />
                        </TouchableOpacity>
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: selectedImage }} style={styles.fullscreenImage} />
                        </View>
                    </BlurView>
                )}

                {/* Loading Animation */}
                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <LottieView
                            source={require('../assets/animations/loading.json')}
                            autoPlay
                            loop
                            style={styles.loadingAnimation}
                        />
                    </View>
                )}
            </LinearGradient>
        </SafeAreaView>
    );
};

const menuCustomStyles = {
    optionsContainer: {
        backgroundColor: '#333333',
        borderRadius: 8,
        padding: 8,
        width: 150,
    },
    optionText: {
        color: '#FFF',
        fontSize: 16,
        padding: 10,
    },
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currentUserAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#4a9eff',
        marginRight: 15,
    },
    headerTextContainer: {
        flexDirection: 'column',
    },
    channelName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },
    currentUserInfo: {
        fontSize: 14,
        color: '#B0B0B0',
        marginTop: 4,
    },
    listContent: {
        paddingBottom: 20,
    },
    memberContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#1C1C1C',
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 5,
        borderLeftColor: '#4a9eff',
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 6,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: '#4a9eff',
        marginRight: 15,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    memberStatus: {
        fontSize: 14,
        color: '#B0B0B0',
        marginTop: 4,
    },
    userOnlineDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#333333',
        position: 'absolute',
        right: 10,
        top: 10,
    },
    menuOption: {
        color: '#FFF',
        fontSize: 16,
        padding: 10,
    },
    blurOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
    },
    imageContainer: {
        width: 200,
        height: 200,
        borderRadius: 100,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#4a9eff',
    },
    fullscreenImage: {
        width: '100%',
        height: '100%',
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
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingAnimation: {
        width: 150,
        height: 150,
    },
});

export default ChannelDetails;