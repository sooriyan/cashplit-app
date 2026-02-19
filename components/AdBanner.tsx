import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { Colors } from '@/constants/Colors';

interface AdBannerProps {
    unitId?: string;
    size?: BannerAdSize;
}

const AdBanner: React.FC<AdBannerProps> = ({
    unitId = TestIds.BANNER, // Using TestIds for development
    size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    if (error) {
        return null; // Don't show anything if ad fails to load
    }

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.dark.primary} size="small" />
                    <Text style={styles.loadingText}>Loading ad...</Text>
                </View>
            )}
            <BannerAd
                unitId={unitId}
                size={size}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                }}
                onAdLoaded={() => setLoading(false)}
                onAdFailedToLoad={(err) => {
                    console.error('Ad failed to load: ', err);
                    setLoading(false);
                    setError(true);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        backgroundColor: 'transparent',
        marginVertical: 10,
        minHeight: 50,
    },
    loadingContainer: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        color: Colors.dark.textMuted,
        fontSize: 12,
    },
});

export default AdBanner;
