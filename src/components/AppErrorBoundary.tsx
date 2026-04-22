import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('AppErrorBoundary caught an error:', error.message);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f7f8fa', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#e8edf9',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
            }}
          >
            <Ionicons name="construct-outline" size={30} color="#4169E1" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 10, textAlign: 'center' }}>
            Still In Progress
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#4b5563', textAlign: 'center', marginBottom: 24 }}>
            We hit a rough edge in this part of the app. This screen is still being polished, so please try again in a moment.
          </Text>
          <TouchableOpacity
            onPress={this.handleRetry}
            style={{
              backgroundColor: '#4169E1',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 16,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
