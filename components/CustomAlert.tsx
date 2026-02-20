import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    onClose: () => void;
    primaryButtonText?: string;
    onPrimaryAction?: () => void;
    secondaryButtonText?: string;
    onSecondaryAction?: () => void;
}

const getIconName = (type: AlertType) => {
    switch (type) {
        case 'success':
            return 'checkmark-circle';
        case 'error':
            return 'alert-circle';
        case 'warning':
            return 'warning';
        case 'info':
        default:
            return 'information-circle';
    }
};

const getIconColor = (type: AlertType) => {
    switch (type) {
        case 'success':
            return Colors.dark.primary;
        case 'error':
            return Colors.dark.danger;
        case 'warning':
            return Colors.dark.warning;
        case 'info':
        default:
            return Colors.dark.primary;
    }
};

export const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    title,
    message,
    type = 'info',
    onClose,
    primaryButtonText = 'OK',
    onPrimaryAction,
    secondaryButtonText,
    onSecondaryAction,
}) => {
    if (!visible) return null;

    const handlePrimaryAction = () => {
        if (onPrimaryAction) {
            onPrimaryAction();
        } else {
            onClose();
        }
    };

    const handleSecondaryAction = () => {
        if (onSecondaryAction) {
            onSecondaryAction();
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.alertContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={getIconName(type) as any}
                            size={48}
                            color={getIconColor(type)}
                        />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        {secondaryButtonText && (
                            <TouchableOpacity
                                style={[styles.button, styles.secondaryButton]}
                                onPress={handleSecondaryAction}
                            >
                                <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.primaryButton,
                                secondaryButtonText ? { flex: 1 } : { width: '100%' }
                            ]}
                            onPress={handlePrimaryAction}
                        >
                            <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: '#121212',
        borderRadius: 24,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    button: {
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    primaryButton: {
        backgroundColor: Colors.dark.primary,
    },
    primaryButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    secondaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
});
