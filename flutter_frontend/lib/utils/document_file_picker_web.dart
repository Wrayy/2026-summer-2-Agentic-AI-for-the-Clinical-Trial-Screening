import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import '../services/api_service.dart';

class SelectedDocument {
  SelectedDocument(this.name, this.bytes);

  final String name;
  final Uint8List bytes;
}

Future<SelectedDocument?> pickDocumentFile() {
  final completer = Completer<SelectedDocument?>();
  final input = web.document.createElement('input') as web.HTMLInputElement;
  input
    ..accept = '.pdf,.docx,.json,.txt,.md'
    ..type = 'file'
    ..multiple = false;

  void completeWithCancel() {
    if (!completer.isCompleted) completer.complete(null);
  }

  input.addEventListener(
      'change',
      ((web.Event _) {
        final files = input.files;
        final file = files != null && files.length > 0 ? files.item(0) : null;
        if (file == null) {
          completeWithCancel();
          return;
        }
        final reader = web.FileReader();
        reader.addEventListener(
            'error',
            ((web.Event _) {
              if (!completer.isCompleted) {
                completer.completeError(
                  ApiException(_fileReadErrorMessage(reader, file.name)),
                );
              }
            }).toJS);
        reader.addEventListener(
            'loadend',
            ((web.Event _) {
              final result = reader.result?.dartify();
              if (result is! String || !result.contains(',')) {
                if (!completer.isCompleted) {
                  completer.completeError(
                    ApiException(
                      'Could not read ${file.name}: unsupported browser file data.',
                    ),
                  );
                }
                return;
              }
              if (!completer.isCompleted) {
                final encoded = result.substring(result.indexOf(',') + 1);
                completer.complete(
                  SelectedDocument(file.name, base64Decode(encoded)),
                );
              }
            }).toJS);
        reader.readAsDataURL(file);
      }).toJS);
  input.addEventListener(
      'cancel',
      ((web.Event _) {
        completeWithCancel();
      }).toJS);

  input.click();
  return completer.future;
}

String _fileReadErrorMessage(web.FileReader reader, String filename) {
  final detail = reader.error?.message;
  if (detail == null || detail.trim().isEmpty) {
    return 'Could not read $filename. Try selecting the file again.';
  }
  return 'Could not read $filename: $detail';
}
