import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Gyroscope } from 'expo-sensors';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    interpolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import { Feather } from '@expo/vector-icons';
import { deleteUser } from 'firebase/auth';
import { auth, deleteUserData } from '../utils/firebaseHelper';

const { width } = Dimensions.get('window');

const RoomCreation = ({ navigation }) => {
    const [isLoading, setIsLoading] = useState(false);
    const createButtonScale = useSharedValue(1);
    const joinButtonScale = useSharedValue(1);
    const offsetX = useSharedValue(0);
    const offsetY = useSharedValue(0);

    useEffect(() => {
        const clearChannelState = async () => {
            await AsyncStorage.removeItem('channelId');
            await AsyncStorage.removeItem('channelName');
        };
        clearChannelState();
    }, []);

    useEffect(() => {
        let subscription;
        const enableGyroscope = async () => {
            try {
                await Gyroscope.requestPermissionsAsync();
                subscription = Gyroscope.addListener(({ x, y }) => {
                    offsetX.value = withSpring(-x * 60, { damping: 12, stiffness: 50 });
                    offsetY.value = withSpring(-y * 60, { damping: 12, stiffness: 50 });
                });
                await Gyroscope.setUpdateInterval(16);
            } catch (error) {
                console.log('Gyroscope setup failed:', error);
            }
        };
        enableGyroscope();
        return () => subscription?.remove();
    }, []);

    const animateButton = (buttonScale) => {
        buttonScale.value = withSequence(
            withTiming(0.95, { duration: 100 }),
            withTiming(1, { duration: 100 })
        );
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Logout',
                    onPress: async () => {
                        await AsyncStorage.removeItem('token');
                        await AsyncStorage.removeItem('userId');
                        navigation.navigate('login');
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    onPress: async () => {
                        try {
                            const userId = await AsyncStorage.getItem('userId');
                            if (userId) {
                                // Delete user data from Firestore
                                await deleteUserData(userId);

                                // Delete user from Firebase Authentication
                                const user = auth.currentUser;
                                if (user) {
                                    await deleteUser(user);
                                }

                                // Clear AsyncStorage and navigate to Login
                                await AsyncStorage.removeItem('token');
                                await AsyncStorage.removeItem('userId');
                                navigation.navigate('login');
                            }
                        } catch (error) {
                            console.error('Failed to delete account:', error);
                            Alert.alert('Error', 'Failed to delete account');
                        }
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const handleJoinChannel = async () => {
        setIsLoading(true);
        try {
            animateButton(joinButtonScale);
            navigation.navigate('ChannelList'); // Navigate to ChannelList screen
        } finally {
            setIsLoading(false);
        }
    };

    const createButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: createButtonScale.value }]
    }));

    const joinButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: joinButtonScale.value }]
    }));

    const shadowAnimatedStyle = useAnimatedStyle(() => {
        const shadowIntensity = Math.sqrt(Math.pow(offsetX.value, 2) + Math.pow(offsetY.value, 2)) / 2 + 12;
        return {
            transform: [{ translateX: offsetX.value * 0.15 }, { translateY: offsetY.value * 0.15 }],
            opacity: interpolate(shadowIntensity, [0, 30], [0.2, 0.4]),
        };
    });

    const secondaryShadowStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offsetX.value * 0.08 }, { translateY: offsetY.value * 0.08 }],
        opacity: 0.15,
    }));

    return (
        <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
                <StatusBar style="light" />
                <View style={styles.headingContainer}>
                    <Text style={styles.welcomeText}>Welcome to Chat Rooms</Text>
                    <Text style={styles.subHeading}>Create a new channel or join an existing one to start chatting with your friends and colleagues.</Text>
                </View>
                <View style={styles.boxContainer}>
                    <Animated.View style={[styles.shadowLayer, styles.shadowLayerPrimary, shadowAnimatedStyle]} />
                    <Animated.View style={[styles.shadowLayer, styles.shadowLayerSecondary, secondaryShadowStyle]} />
                    <View style={styles.loginBox}>
                        <Animated.View style={createButtonAnimatedStyle}>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={() => {
                                    animateButton(createButtonScale);
                                    navigation.navigate('CreateChannel'); // Navigate to CreateChannel screen
                                }}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#4a9eff', '#3b7fd1']}
                                    style={styles.gradientButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.buttonText}>Create Channel</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>

                        <View style={styles.buttonSeparator}>
                            <View style={styles.separatorLine} />
                            <Text style={styles.separatorText}>OR</Text>
                            <View style={styles.separatorLine} />
                        </View>

                        <Animated.View style={joinButtonAnimatedStyle}>
                            <TouchableOpacity
                                style={[styles.button, styles.joinButton]}
                                onPress={handleJoinChannel}
                                activeOpacity={0.8}
                                disabled={isLoading}
                            >
                                <LinearGradient
                                    colors={['#2d2d2d', '#1f1f1f']}
                                    style={styles.gradientButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    {isLoading ? (
                                        <Text style={[styles.buttonText, styles.joinButtonText]}>Loading...</Text>
                                    ) : (
                                        <Text style={[styles.buttonText, styles.joinButtonText]}>Join Channel</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>
            </ScrollView>

            {/* 3-dot menu */}
            <View style={styles.menuContainer}>
                <Menu>
                    <MenuTrigger>
                        <Feather name="more-vertical" size={24} color="white" />
                    </MenuTrigger>
                    <MenuOptions customStyles={menuCustomStyles}>
                        <MenuOption onSelect={handleLogout}>
                            <Text style={styles.menuOption}>Logout</Text>
                        </MenuOption>
                        <MenuOption onSelect={handleDeleteAccount}>
                            <Text style={[styles.menuOption, styles.deleteOption]}>Delete Account</Text>
                        </MenuOption>
                    </MenuOptions>
                </Menu>
            </View>
        </LinearGradient>
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
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    headingContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    welcomeText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
        fontFamily: 'Inter_Bold',
        textAlign: 'center',
    },
    subHeading: {
        fontSize: 16,
        color: '#B0B0B0',
        fontFamily: 'Inter_Regular',
        textAlign: 'center',
        marginHorizontal: 20,
    },
    boxContainer: {
        padding: 40,
        width: '100%',
        alignItems: 'center',
        position: 'relative',
    },
    shadowLayer: {
        position: 'absolute',
        top: 40,
        left: 40,
        right: 40,
        bottom: 40,
        borderRadius: 20,
    },
    shadowLayerPrimary: {
        backgroundColor: '#4a9eff',
        elevation: 12,
    },
    shadowLayerSecondary: {
        backgroundColor: '#ffffff',
        elevation: 8,
    },
    loginBox: {
        width: '100%',
        maxWidth: 268,
        padding: 30,
        borderRadius: 20,
        backgroundColor: '#1C1C1C',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        zIndex: 1,
    },
    button: {
        width: '100%',
        height: 55,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 15,
    },
    joinButton: {
        borderWidth: 1,
        borderColor: '#4a9eff',
    },
    gradientButton: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Inter_Bold',
    },
    joinButtonText: {
        color: '#4a9eff',
    },
    buttonSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    separatorText: {
        color: '#B0B0B0',
        marginHorizontal: 10,
        fontSize: 14,
        fontFamily: 'Inter_Medium',
    },
    menuContainer: {
        position: 'absolute',
        top: 50,
        right: 20,
    },
    menuOption: {
        color: '#FFF',
        fontSize: 16,
        padding: 10,
    },
    deleteOption: {
        color: '#FF0000',
    },
});

export default RoomCreation;