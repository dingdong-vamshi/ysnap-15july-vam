import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IconName =
  | 'home'
  | 'converse'
  | 'camera'
  | 'practice'
  | 'profile'
  | 'type'
  | 'voice'
  | 'settings'
  | 'swap'
  | 'speaker';

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
  focused?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 24,
  color = '#000000',
  focused = false,
}) => {
  const getIconName = (): any => {
    switch (name) {
      case 'home':
        return focused ? 'home' : 'home-outline';
      case 'converse':
        return focused ? 'chatbubbles' : 'chatbubbles-outline';
      case 'camera':
        return focused ? 'camera' : 'camera-outline';
      case 'practice':
        return focused ? 'school' : 'school-outline';
      case 'profile':
        return focused ? 'person-circle' : 'person-circle-outline';
      case 'type':
        return focused ? 'document-text' : 'document-text-outline';
      case 'voice':
        return focused ? 'mic' : 'mic-outline';
      case 'settings':
        return focused ? 'settings' : 'settings-outline';
      case 'swap':
        return 'swap-horizontal';
      case 'speaker':
        return focused ? 'volume-high' : 'volume-high-outline';
      default:
        return 'help-circle-outline';
    }
  };

  return <Ionicons name={getIconName()} size={size} color={color} />;
};

export default AppIcon;
