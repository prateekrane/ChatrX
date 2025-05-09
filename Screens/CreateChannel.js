import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons'; // Import MaterialIcons for the copy icon
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseHelper';
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const CreateChannel = ({ navigation }) => {
    const [channelName, setChannelName] = useState('');
    const [numberOfMembers, setNumberOfMembers] = useState('');
    const [channelCode, setChannelCode] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateChannel = async () => {
        if (!channelName.trim()) {
            Alert.alert('Error', 'Channel name is required.');
            return;
        }

        const members = parseInt(numberOfMembers, 10);
        if (isNaN(members) || members <= 0 || members > 10) {
            Alert.alert('Error', 'Number of members must be between 1 and 10.');
            return;
        }

        setIsLoading(true);
        try {
            const channelId = `${channelName}_${channelCode}`;
            const userId = await AsyncStorage.getItem('userId'); // Get the current user ID
            const userDoc = await getDoc(doc(db, 'users', userId)); // Fetch user details
            const userData = userDoc.exists() ? userDoc.data() : {};

            // Create the channel and add the current user as a member
            await setDoc(doc(db, 'channels', channelId), {
                name: channelName,
                code: channelCode,
                maxMembers: members,
                createdAt: new Date().toISOString(),
                members: [
                    {
                        id: userId,
                        name: userData.name,
                        photoURL: userData.photoURL,
                    },
                ],
            });

            // Store the channel state in AsyncStorage
            await AsyncStorage.setItem('channelId', channelId);
            await AsyncStorage.setItem('channelName', channelName);

            navigation.navigate('ChannelDetails', {
                channelName,
                channelId,
            });
        } catch (error) {
            console.error('Error creating channel:', error);
            Alert.alert('Error', 'Failed to create channel. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = () => {
        Clipboard.setString(channelCode);
        Alert.alert('Copied', 'Channel code copied to clipboard!');
    };

    return (
        <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
                <StatusBar style="light" />
                <View style={styles.headingContainer}>
                    <Text style={styles.welcomeText}>Create a New Channel</Text>
                    <Text style={styles.subHeading}>Fill in the details below to create your channel.</Text>
                </View>
                <View style={styles.boxContainer}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Channel Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter channel name"
                            placeholderTextColor="#666666"
                            value={channelName}
                            onChangeText={setChannelName}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Number of Members</Text>
                        <View style={styles.memberInputContainer}>
                            <TouchableOpacity
                                style={styles.memberButton}
                                onPress={() => {
                                    const newValue = Math.max(1, parseInt(numberOfMembers || '2', 10) - 1);
                                    setNumberOfMembers(newValue.toString());
                                }}
                            >
                                <Text style={styles.memberButtonText}>-</Text>
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.input, styles.memberInput]}
                                placeholder="Enter number of members (max 10)"
                                placeholderTextColor="#666666"
                                value={numberOfMembers || '2'}
                                onChangeText={setNumberOfMembers}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                                style={styles.memberButton}
                                onPress={() => {
                                    const newValue = Math.min(10, parseInt(numberOfMembers || '2', 10) + 1);
                                    setNumberOfMembers(newValue.toString());
                                }}
                            >
                                <Text style={styles.memberButtonText}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Channel Code</Text>
                        <View style={styles.channelCodeContainer}>
                            {channelCode.split('').map((digit, index) => (
                                <View key={index} style={styles.codeBox}>
                                    <Text style={styles.codeText}>{digit}</Text>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                                <MaterialIcons name="content-copy" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleCreateChannel}
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
        padding: width * 0.05, // Responsive padding
    },
    headingContainer: {
        alignItems: 'center',
        marginBottom: height * 0.05, // Responsive margin
    },
    welcomeText: {
        fontSize: width * 0.09, // Responsive font size
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: height * 0.01,
        fontFamily: 'Inter_Bold',
        textAlign: 'center',
    },
    subHeading: {
        fontSize: width * 0.04,
        color: '#B0B0B0',
        fontFamily: 'Inter_Regular',
        textAlign: 'center',
        marginHorizontal: width * 0.05,
    },
    boxContainer: {
        padding: width * 0.1,
        width: '100%',
        alignItems: 'center',
        position: 'relative',
    },
    inputContainer: {
        width: '100%',
        maxWidth: width * 0.8, // Responsive max width
        marginBottom: height * 0.02,
    },
    inputLabel: {
        color: '#FFFFFF',
        marginBottom: 8,
        fontSize: 14,
        fontFamily: 'Inter_Medium',
    },
    input: {
        width: '100%',
        height: height * 0.07, // Responsive height
        backgroundColor: '#2A2A2A',
        borderRadius: width * 0.03,
        padding: width * 0.04,
        color: '#FFF',
        fontFamily: 'Inter_Regular',
        fontSize: width * 0.04,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    disabledInput: {
        backgroundColor: '#1C1C1C',
        color: '#666666',
    },
    button: {
        width: '100%',
        height: height * 0.07,
        borderRadius: width * 0.03,
        overflow: 'hidden',
        marginTop: height * 0.03,
    },
    gradientButton: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: width * 0.045,
        fontWeight: 'bold',
        fontFamily: 'Inter_Bold',
    },
    memberInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberButton: {
        width: width * 0.1,
        height: width * 0.1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#4a9eff',
        borderRadius: width * 0.02,
        marginHorizontal: width * 0.02,
    },
    memberButtonText: {
        color: '#FFF',
        fontSize: width * 0.05,
        fontWeight: 'bold',
    },
    memberInput: {
        textAlign: 'center',
        width: width * 0.15,
    },
    channelCodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: height * 0.01,
    },
    codeBox: {
        width: width * 0.1,
        height: width * 0.1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        borderRadius: width * 0.02,
        marginHorizontal: width * 0.01,
    },
    codeText: {
        color: '#FFF',
        fontSize: width * 0.05,
        fontWeight: 'bold',
    },
    copyButton: {
        marginLeft: width * 0.02,
        padding: width * 0.02,
        backgroundColor: '#4a9eff',
        borderRadius: width * 0.02,
        justifyContent: 'center',
        alignItems: 'center',
    },
    copyButtonText: {
        color: '#FFF',
        fontSize: 14,
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
    },
    loadingAnimation: {
        width: 150,
        height: 150,
    },
});

export default CreateChannel;