import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Dimensions, ScrollView, Alert } from 'react-native';
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
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isFocused, setIsFocused] = useState({ email: false, password: false });
    const [isLoading, setIsLoading] = useState(false);

    const buttonScale = useSharedValue(1);
    const offsetX = useSharedValue(0);
    const offsetY = useSharedValue(0);

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

    const animateButton = () => {
        buttonScale.value = withSequence(
            withTiming(0.95, { duration: 100 }),
            withTiming(1, { duration: 100 })
        );
    };

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                // Store current user's ID so that ChatList shows the correct account.
                await AsyncStorage.setItem('userId', data.localId);
                await AsyncStorage.setItem('token', data.idToken);
                Alert.alert('Login Successful', `Welcome back, ${data.email}!`);
                navigation.navigate('RoomCreation');
            } else {
                Alert.alert('Login Failed', data.error?.message || 'Something went wrong');
            }
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setIsLoading(false);
        }
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
                        await AsyncStorage.clear(); // Clear all stored data
                        navigation.navigate('Login');
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }]
    }));

    // Primary shadow layer
    const shadowAnimatedStyle = useAnimatedStyle(() => {
        const shadowIntensity = Math.sqrt(Math.pow(offsetX.value, 2) + Math.pow(offsetY.value, 2)) / 2 + 12;
        return {
            transform: [{ translateX: offsetX.value * 0.15 }, { translateY: offsetY.value * 0.15 }],
            opacity: interpolate(shadowIntensity, [0, 30], [0.2, 0.4]),
        };
    });

    // Secondary shadow layer for depth
    const secondaryShadowStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offsetX.value * 0.08 }, { translateY: offsetY.value * 0.08 }],
        opacity: 0.15,
    }));

    return (
        <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
                <StatusBar style="light" />
                <View style={styles.headingContainer}>
                    <Text style={styles.welcomeText}>Welcome Back</Text>
                    <Text style={styles.subHeading}>Enter your credentials to continue</Text>
                </View>
                <View style={styles.boxContainer}>
                    {/* Multiple shadow layers for depth */}
                    <Animated.View style={[styles.shadowLayer, styles.shadowLayerPrimary, shadowAnimatedStyle]} />
                    <Animated.View style={[styles.shadowLayer, styles.shadowLayerSecondary, secondaryShadowStyle]} />
                    <View style={styles.loginBox}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={[styles.input, isFocused.email && styles.inputFocused]}
                                placeholder="Enter your email"
                                placeholderTextColor="#666666"
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setIsFocused(prev => ({ ...prev, email: true }))}
                                onBlur={() => setIsFocused(prev => ({ ...prev, email: false }))}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                multiline={false} // Ensure single-line input
                                textAlignVertical="center" // Center text vertically
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <TextInput
                                style={[styles.input, isFocused.password && styles.inputFocused]}
                                placeholder="Enter your password"
                                placeholderTextColor="#666666"
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setIsFocused(prev => ({ ...prev, password: true }))}
                                onBlur={() => setIsFocused(prev => ({ ...prev, password: false }))}
                                secureTextEntry
                                multiline={false} // Ensure single-line input
                                textAlignVertical="center" // Center text vertically
                            />
                        </View>
                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>
                        <Animated.View style={buttonAnimatedStyle}>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={async () => {
                                    animateButton();
                                    await handleLogin();
                                }}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#4a9eff', '#3b7fd1']}
                                    style={styles.gradientButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.buttonText}>Login</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                        <View style={styles.signupContainer}>
                            <Text style={styles.signupText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                <Text style={styles.signupLink}>Sign Up</Text>
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
        marginBottom: 40,
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
        maxWidth: 268, // Fixed width
        padding: 30,
        borderRadius: 20,
        backgroundColor: '#1C1C1C',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        zIndex: 1,
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
        height: 55, // Fixed height
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        padding: 15,
        color: '#FFF',
        fontFamily: 'Inter_Regular',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputFocused: {
        borderColor: '#4a9eff',
        backgroundColor: '#2d2d2d',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    forgotPasswordText: {
        color: '#4a9eff',
        fontSize: 14,
        fontFamily: 'Inter_Medium',
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

export default LoginScreen;
