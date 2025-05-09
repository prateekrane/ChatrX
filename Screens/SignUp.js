import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Dimensions, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
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
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storeUserData } from '../utils/firebaseHelper';
import { uploadToByteScale } from '../utils/bytescaleHelper';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

const SignUpScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [isFocused, setIsFocused] = useState({ name: false, email: false, password: false });
    const [isLoading, setIsLoading] = useState(false);

    const buttonScale = useSharedValue(1);
    const offsetX = useSharedValue(0);
    const offsetY = useSharedValue(0);

    const defaultPhotoUrl = 'https://img.freepik.com/premium-vector/account-icon-user-icon-vector-graphics_292645-552.jpg?semt=ais_hybrid'; // Replace with your default photo URL

    useEffect(() => {
        let subscription;

        const enableGyroscope = async () => {
            try {
                await Gyroscope.requestPermissionsAsync();
                subscription = Gyroscope.addListener(({ x, y }) => {
                    offsetX.value = withSpring(-x * 60, {
                        damping: 12,
                        stiffness: 50
                    });
                    offsetY.value = withSpring(-y * 60, {
                        damping: 12,
                        stiffness: 50
                    });
                });
                await Gyroscope.setUpdateInterval(16);
            } catch (error) {
                Alert.alert('Gyroscope setup failed:', error);
            }
        };

        enableGyroscope();
        return () => subscription?.remove();
    }, []);

    // Add permission check for image picker
    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('Sorry, we need camera roll permissions to upload a profile photo!');
            }
        })();
    }, []);

    const animateButton = () => {
        buttonScale.value = withSequence(
            withTiming(0.95, { duration: 100 }),
            withTiming(1, { duration: 100 })
        );
    };

    const handleSignUp = async () => {
        setIsLoading(true);
        try {
            // Validate inputs
            if (!email || !password || !name) {
                Alert.alert('Error', 'Please fill in all fields');
                setIsLoading(false);
                return;
            }

            // Validate profile photo
            if (!profilePhoto) {
                Alert.alert('Error', 'Please select a profile photo');
                setIsLoading(false);
                return;
            }

            // 1. Create user account
            const signUpResponse = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            });

            const userData = await signUpResponse.json();

            if (!signUpResponse.ok) {
                throw new Error(userData.error?.message || 'Failed to create account');
            }

            // 2. Upload avatar if exists
            let photoURL = defaultPhotoUrl;
            let bytescaleData = null;
            if (profilePhoto) {
                try {
                    const uploadResponse = await uploadToByteScale(profilePhoto);
                    photoURL = uploadResponse.fileUrl;
                    bytescaleData = {
                        accountId: uploadResponse.accountId,
                        filePath: uploadResponse.filePath,
                        lastModified: uploadResponse.lastModified,
                    };
                } catch (uploadError) {
                    console.error('Upload error:', uploadError);
                    Alert.alert('Warning', 'Failed to upload profile photo, continuing with default photo');
                    photoURL = defaultPhotoUrl;
                }
            }

            // 3. Store user data in Firestore with ByteScale data
            await storeUserData(userData.localId, {
                name,
                email,
                photoURL,
                bytescale: bytescaleData, // Store all ByteScale related data
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });

            // 4. Store auth token and navigate
            await AsyncStorage.setItem('token', userData.idToken);
            await AsyncStorage.setItem('userId', userData.localId);

            Alert.alert('Success', 'Account created successfully!', [
                { text: 'OK', onPress: () => navigation.navigate('RoomCreation') }
            ]);

        } catch (error) {
            console.error('SignUp error:', error);
            Alert.alert('Error', error.message || 'Failed to create account');
        } finally {
            setIsLoading(false);
        }
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }]
    }));

    // Primary shadow layer
    const shadowAnimatedStyle = useAnimatedStyle(() => {
        const shadowIntensity = Math.sqrt(
            Math.pow(offsetX.value, 2) + Math.pow(offsetY.value, 2)
        ) / 2 + 12;

        return {
            transform: [
                { translateX: offsetX.value * 0.15 },
                { translateY: offsetY.value * 0.15 }
            ],
            opacity: interpolate(shadowIntensity, [0, 30], [0.2, 0.4]),
        };
    });

    // Secondary shadow layer for depth
    const secondaryShadowStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: offsetX.value * 0.08 },
            { translateY: offsetY.value * 0.08 }
        ],
        opacity: 0.15,
    }));

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5, // Reduced quality for better upload performance
                base64: false
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                setProfilePhoto(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    return (
        <LinearGradient
            colors={['#000000', '#1a1a1a', '#000000']}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
                <StatusBar style="light" />

                <View style={styles.headingContainer}>
                    <Text style={styles.welcomeText}>Create Account</Text>
                    <Text style={styles.subHeading}>Sign up to get started</Text>
                </View>

                <View style={styles.boxContainer}>
                    {/* Multiple shadow layers for depth */}
                    <Animated.View style={[styles.shadowLayer, styles.shadowLayerPrimary, shadowAnimatedStyle]} />
                    <Animated.View style={[styles.shadowLayer, styles.shadowLayerSecondary, secondaryShadowStyle]} />

                    <View style={styles.loginBox}>
                        <TouchableOpacity onPress={pickImage} style={styles.profilePhotoContainer}>
                            <Image
                                source={{ uri: profilePhoto || defaultPhotoUrl }}
                                style={styles.profilePhoto}
                            />
                            <Text style={styles.addPhotoText}>Add Profile Photo</Text>
                        </TouchableOpacity>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Name</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    isFocused.name && styles.inputFocused
                                ]}
                                placeholder="Enter your name"
                                placeholderTextColor="#666666"
                                value={name}
                                onChangeText={setName}
                                onFocus={() => setIsFocused(prev => ({ ...prev, name: true }))}
                                onBlur={() => setIsFocused(prev => ({ ...prev, name: false }))}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    isFocused.email && styles.inputFocused
                                ]}
                                placeholder="Enter your email"
                                placeholderTextColor="#666666"
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setIsFocused(prev => ({ ...prev, email: true }))}
                                onBlur={() => setIsFocused(prev => ({ ...prev, email: false }))}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    isFocused.password && styles.inputFocused
                                ]}
                                placeholder="Enter your password"
                                placeholderTextColor="#666666"
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setIsFocused(prev => ({ ...prev, password: true }))}
                                onBlur={() => setIsFocused(prev => ({ ...prev, password: false }))}
                                secureTextEntry
                            />
                        </View>

                        <Animated.View style={buttonAnimatedStyle}>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={async () => {
                                    animateButton();
                                    await handleSignUp();
                                }}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#4a9eff', '#3b7fd1']}
                                    style={styles.gradientButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.buttonText}>Sign Up</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>

                        <View style={styles.signupContainer}>
                            <Text style={styles.signupText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('login')}>
                                <Text style={styles.signupLink}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>

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
    );
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

    },
    welcomeText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
        fontFamily: 'Inter_Bold',
    },
    subHeading: {
        fontSize: 16,
        color: '#B0B0B0',
        fontFamily: 'Inter_Regular',
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
    profilePhotoContainer: {
        alignItems: 'center',
        marginBottom: 20,
        padding: 10,
    },
    profilePhoto: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 10,
        backgroundColor: '#2A2A2A',
    },
    addPhotoText: {
        color: '#4a9eff',
        fontSize: 14,
        fontFamily: 'Inter_Medium',
        marginTop: 8,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        color: '#FFFFFF',
        marginBottom: 8,
        fontSize: 14,
        fontFamily: 'Inter_Medium',
    },
    input: {
        width: '100%',
        height: 55,
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        padding: 15,
        color: '#FFF',
        fontFamily: 'Inter_Regular',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputFocused: {
        borderColor: '#4a9eff',
        backgroundColor: '#2d2d2d',
    },
    button: {
        width: '100%',
        height: 55,
        borderRadius: 12,
        overflow: 'hidden',
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
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    signupText: {
        color: '#B0B0B0',
        fontSize: 14,
        fontFamily: 'Inter_Regular',
    },
    signupLink: {
        color: '#4a9eff',
        fontSize: 14,
        fontFamily: 'Inter_Medium',
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
    },
    loadingAnimation: {
        width: 150,
        height: 150,
    },
});

export default SignUpScreen;
