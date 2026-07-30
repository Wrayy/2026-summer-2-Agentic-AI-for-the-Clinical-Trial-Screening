import 'dart:typed_data';

class SelectedDocument {
  SelectedDocument(this.name, this.bytes);

  final String name;
  final Uint8List bytes;
}

Future<SelectedDocument?> pickDocumentFile() {
  throw UnsupportedError('Document upload is only available in a browser.');
}
