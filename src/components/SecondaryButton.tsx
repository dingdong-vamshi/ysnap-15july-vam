import React from 'react';
import { TactileButton } from './ui/TactileButton';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: any;
  textStyle?: any;
  size?: 'normal' | 'small';
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = (props) => {
  return <TactileButton {...props} variant="secondary" />;
};

export default SecondaryButton;
