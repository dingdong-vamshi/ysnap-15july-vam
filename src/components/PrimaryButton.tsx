import React from 'react';
import { TactileButton } from './ui/TactileButton';

interface PrimaryButtonProps {
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

export const PrimaryButton: React.FC<PrimaryButtonProps> = (props) => {
  return <TactileButton {...props} variant="primary" />;
};

export default PrimaryButton;
