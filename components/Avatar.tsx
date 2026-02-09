import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
    name: string;
    size?: number;
    fontSize?: number;
    rounded?: boolean;
    borderWidth?: number;
}

export const AVATAR_COLORS = [
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
];
export const getAvatarColor = (n: string) => {
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
        hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};

export const Avatar: React.FC<AvatarProps> = ({ name, size = 40, fontSize = 16, rounded = false, borderWidth = 1.5 }) => {
    const getInitials = (n: string) => {
        return n
            .split(' ')
            .map((part) => part.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const initials = getInitials(name || 'Group');
    const backgroundColor = getAvatarColor(name || 'Group');

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius: rounded ? size * 0.2 : size / 2,
                    backgroundColor: backgroundColor + '20', // Faded background
                    borderColor: backgroundColor,
                    borderWidth,
                },
            ]}
        >
            <Text style={[styles.text, { fontSize, color: backgroundColor }]}>
                {initials}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontWeight: 'bold',
    },
});
