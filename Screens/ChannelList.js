import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseHelper';

const ChannelList = ({ navigation }) => {
    const [channels, setChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const channelsCollection = collection(db, 'channels');
                const channelsSnapshot = await getDocs(channelsCollection);
                const channelsList = channelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setChannels(channelsList);
            } catch (error) {
                console.error('Error fetching channels:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChannels();
    }, []);

    if (isLoading) {
        return (
            <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4a9eff" />

                </View>
            </LinearGradient>
        );
    }

    const renderItem = ({ item }) => (
        <View style={styles.channelContainer}>
            <TouchableOpacity
                style={styles.profilePhoto}
                onPress={() => console.log('Profile photo clicked for:', item.name)} // Replace with logic to open profile photo
            >
                <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoText}>{item.name[0]}</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.channelDetails}
                onPress={() => navigation.navigate('ChannelCode', { channelId: item.id, channelName: item.name })}
            >
                <Text style={styles.channelName}>{item.name}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <LinearGradient colors={['#000000', '#1a1a1a', '#000000']} style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerText}>Available Channels</Text>
            </View>
            <FlatList
                data={channels}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
        marginTop: 40, // Added extra spacing for the notch
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },
    listContent: {
        paddingBottom: 20,
    },
    channelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 5,
    },
    profilePhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#4a9eff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    photoPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    channelDetails: {
        flex: 1,
    },
    channelName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        color: '#FFF',
        marginTop: 10,
    },
    scrollContent: {
        flexGrow: 1,
    },
});

export default ChannelList;