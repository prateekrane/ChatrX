import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuProvider } from 'react-native-popup-menu';
import LoginScreen from './Screens/Login';
import SignUpScreen from './Screens/SignUp';
import ChatList from './Screens/ChatList';
import ProfilePicture from './Screens/ProfilePicture';
import ChatScreen from './Screens/ChatScreen';
import RoomCreation from './Screens/RoomCreation';
import CreateChannel from './Screens/CreateChannel';
import ChannelDetails from './Screens/ChannelDetails';
import ChannelEnterCode from './Screens/ChannelEnterCode';
import ChannelList from './Screens/ChannelList';

SplashScreen.preventAutoHideAsync(); // Prevent splash screen from hiding automatically

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_Regular: Inter_400Regular,
    Inter_Bold: Inter_700Bold,
  });

  const [initialRoute, setInitialRoute] = useState(null);
  const [channelParams, setChannelParams] = useState(null);

  useEffect(() => {
    const determineInitialRoute = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');
        const channelId = await AsyncStorage.getItem('channelId');
        const channelName = await AsyncStorage.getItem('channelName');

        if (!token || !userId) {
          // If no token or userId, navigate to Login
          setInitialRoute('login');
        } else if (channelId && channelName) {
          // If channelId and channelName exist, navigate to ChannelDetails
          setInitialRoute('ChannelDetails');
          setChannelParams({ channelId, channelName });
        } else {
          // Default to RoomCreation if no channelId and user is logged in
          setInitialRoute('RoomCreation');
        }
      } catch (error) {
        console.error('Error determining initial route:', error);
        setInitialRoute('login'); // Fallback to Login in case of error
      }
    };

    determineInitialRoute();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync(); // Hide splash screen once fonts are loaded
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || !initialRoute) {
    return <View />; // Show empty view while determining the initial route or loading fonts
  }

  return (
    <MenuProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'white' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="login"
            component={LoginScreen}
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="Signup"
            component={SignUpScreen}
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="List"
            component={ChatList}
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="ProfilePicture"
            component={ProfilePicture}
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="ChatScreen"
            component={ChatScreen}
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="RoomCreation"
            component={RoomCreation}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="CreateChannel"
            component={CreateChannel}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ChannelDetails"
            component={ChannelDetails}
            initialParams={channelParams} // Pass channelId and channelName as initial params
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="ChannelCode"
            component={ChannelEnterCode}
            options={{
              statusBarHidden: true,
            }}
          />
          <Stack.Screen
            name="ChannelList"
            component={ChannelList}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </MenuProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
