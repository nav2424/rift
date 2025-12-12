import { Tabs, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Platform, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/DesignSystem';

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { name: 'Home', route: '/(tabs)/dashboard', icon: 'home' },
    { name: 'Create', route: '/(tabs)/create', icon: 'plus' },
    { name: 'Messages', route: '/(tabs)/messages', icon: 'chatbubbles' },
    { name: 'Account', route: '/(tabs)/account', icon: 'person' },
  ];

  const isActive = (route: string) => {
    if (route === '/(tabs)/dashboard') {
      return pathname === '/dashboard' || pathname === '/(tabs)/dashboard' || pathname === '/';
    }
    return pathname === route || pathname?.startsWith(route);
  };

  return (
    <View style={styles.customTabBarContainer}>
      <View style={styles.customTabBar}>
        <View style={styles.tabBarBackgroundWrapper} pointerEvents="none">
          <BlurView intensity={100} tint="dark" style={styles.tabBarBlur}>
            <LinearGradient
              colors={[
                'rgba(0, 0, 0, 0.85)',
                'rgba(10, 10, 10, 0.95)',
                'rgba(5, 5, 5, 0.9)',
                'rgba(0, 0, 0, 0.88)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.08)',
                'rgba(255, 255, 255, 0.03)',
                'rgba(255, 255, 255, 0.06)',
                'rgba(255, 255, 255, 0.02)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
          <View style={styles.tabBarBorder} />
          <View style={styles.tabBarShadowOverlay} />
        </View>
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tabBarItem}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              <TabIcon name={tab.icon} focused={active} />
              <Text style={[styles.tabBarLabel, active && styles.tabBarLabelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();

  // Don't render tabs if not authenticated - index.tsx will handle redirect
  if (loading || !user) {
    return null;
  }

  return (
    <View style={styles.tabsContainer}>
      <Tabs
        tabBar={() => <CustomTabBar />}
        screenOptions={{
        headerStyle: {
          backgroundColor: 'transparent',
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerBackground: () => (
          <BlurView
            intensity={30}
            tint="dark"
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            }}
          />
        ),
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '300',
          fontSize: 34, // 34-38pt range
          letterSpacing: 0.34, // +1% of 34
        },
        tabBarStyle: {
          display: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: '',
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          headerShown: false,
          tabBarLabel: 'Create',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="plus" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '',
          headerShown: false,
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="chatbubbles" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: '',
          headerShown: false,
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="person" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
    </View>
  );
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
    home: focused ? 'home' : 'home-outline',
    plus: focused ? 'add-circle' : 'add-circle-outline',
    chatbubbles: focused ? 'chatbubbles' : 'chatbubbles-outline',
    person: focused ? 'person' : 'person-outline',
  };
  
  const color = focused ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
  const size = 24;
  
  if (focused) {
    return (
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        />
        <Ionicons 
          name={iconMap[name] || 'ellipse-outline'} 
          size={size} 
          color={color}
          style={styles.icon}
        />
      </View>
    );
  }
  
  return (
    <View style={styles.iconContainerUnfocused}>
      <Ionicons 
        name={iconMap[name] || 'ellipse-outline'} 
        size={size} 
        color={color}
        style={styles.icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flex: 1,
  },
  customTabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    pointerEvents: 'box-none',
  },
  customTabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 72 : 68,
    borderRadius: 28,
    paddingHorizontal: Spacing.md,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  tabBarBackgroundWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    overflow: 'hidden',
  },
  tabBarBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  tabBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.9,
    pointerEvents: 'none',
  },
  tabBarShadowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    pointerEvents: 'none',
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: Platform.OS === 'ios' ? 72 : 68,
    paddingVertical: Platform.OS === 'ios' ? 20 : 12,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '300',
    marginTop: 4,
    letterSpacing: 0.3,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tabBarLabelActive: {
    color: '#ffffff',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  iconContainerUnfocused: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  icon: {
    position: 'relative',
    zIndex: 1,
  },
});

