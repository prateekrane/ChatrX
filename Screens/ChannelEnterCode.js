import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChannelEnterCode = ({ navigation }) => {
    const [code, setCode] = useState(['', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef([]);

    const handleInputChange = (value, index) => {
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus(); // Move to the next input box
        }
    };

    const handleJoinChannel = async () => {
        const enteredCode = code.join('');
        if (enteredCode.length !== 4) {
            Alert.alert('Error', 'Please enter a valid 4-digit code.');
            return;
        }

        setIsLoading(true); // Start loading animation
        try {
            // Query Firestore to find the channel with the entered code
            const channelsCollection = collection(db, 'channels');
            const q = query(channelsCollection, where('code', '==', enteredCode));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const channelData = querySnapshot.docs[0].data();
                const channelId = querySnapshot.docs[0].id;

                // Get the current user ID
                const userId = await AsyncStorage.getItem('userId');

                // Fetch user details from Firestore
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Register the user in the channel
                    const channelDocRef = doc(db, 'channels', channelId);
                    await updateDoc(channelDocRef, {
                        members: arrayUnion({
                            id: userId,
                            name: userData.name,
                            photoURL: userData.photoURL
                        })
                    });

                    // Navigate to the channel details
                    navigation.navigate('ChannelDetails', {
                        channelName: channelData.name,
                        channelId: channelId
                    });
                } else {
                    Alert.alert('Error', 'User details not found. Please try again.');
                }
            } else {
                Alert.alert('Error', 'Invalid channel code. Please try again.');
                setCode(['', '', '', '']); // Clear all text fields
                inputRefs.current[0]?.focus(); // Move cursor to the first input box
            }
        } catch (error) {
            console.error('Error joining channel:', error);
            Alert.alert('Error', 'Failed to join the channel. Please try again.');
        } finally {
            setIsLoading(false); // Stop loading animation
        }
    };

    return (
        <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
            <View style={styles.headingContainer}>
                <Text style={styles.welcomeText}>Enter Channel Code</Text>
                <Text style={styles.subHeading}>Please enter the 4-digit code to join the channel.</Text>
            </View>
            <View style={styles.codeInputContainer}>
                {code.map((digit, index) => (
                    <TextInput
                        key={index}
                        ref={(ref) => (inputRefs.current[index] = ref)}
                        style={styles.codeBox}
                        maxLength={1}
                        keyboardType="numeric"
                        value={digit}
                        onChangeText={(value) => handleInputChange(value, index)}
                    />
                ))}
            </View>
            <TouchableOpacity
                style={styles.button}
                onPress={handleJoinChannel}
                activeOpacity={0.8}
                disabled={isLoading} // Disable button while loading
            >
                <LinearGradient
                    colors={['#4a9eff', '#3b7fd1']}
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Text style={styles.buttonText}>Join Channel</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
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
        textAlign: 'center',
    },
    subHeading: {
        fontSize: 16,
        color: '#B0B0B0',
        fontFamily: 'Inter_Regular',
        textAlign: 'center',
        marginHorizontal: 20,
    },
    codeInputContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 30,
    },
    codeBox: {
        width: 50,
        height: 50,
        marginHorizontal: 10,
        backgroundColor: '#2A2A2A',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 18,
        color: '#FFF',
        fontWeight: 'bold',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
});

export default ChannelEnterCode;