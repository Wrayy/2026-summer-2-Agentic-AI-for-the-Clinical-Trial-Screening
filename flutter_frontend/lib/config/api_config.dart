class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://tysnx3mi2s.us-east-1.awsapprunner.com',
  );
}
