class MatchingCriteria {
  MatchingCriteria({
    required this.enabled,
    required this.values,
  });

  factory MatchingCriteria.fromTrial(Map<String, dynamic> trial) {
    final exclusion = trial['exclusion_criteria'] is Map<String, dynamic>
        ? trial['exclusion_criteria'] as Map<String, dynamic>
        : <String, dynamic>{};
    return MatchingCriteria(
      enabled: {
        'pathology': true,
        'gender': true,
        'age': true,
        'diseases': true,
        'bmi': true,
        'priorMedications': true,
        'surgeries': true,
        'pregnancy': true,
      },
      values: {
        'pathology': trial['pathology']?.toString() ?? '',
        'gender': trial['gender']?.toString() ?? '',
        'ageRange': trial['age_range']?.toString() ?? '0-99',
        'bmiRange': exclusion['BMI']?.toString() ?? '> 1 and < 99',
        'diseases': exclusion['Diseases']?.toString() ?? '',
        'priorMedications': (exclusion['Prior Medications'] ??
                exclusion['PriorMedications'] ??
                '')
            .toString(),
        'surgeries': exclusion['Surgeries']?.toString() ?? '',
        'pregnancy': exclusion['Pregnancy']?.toString() ?? 'Unrestricted',
      },
    );
  }

  final Map<String, bool> enabled;
  final Map<String, String> values;

  Map<String, dynamic> get requestValues => {
        'pathology': enabled['pathology'] == true ? values['pathology'] : '',
        'gender': enabled['gender'] == true ? values['gender'] : '',
        'ageRange': enabled['age'] == true ? values['ageRange'] : '0-99',
        'bmiRange': enabled['bmi'] == true
            ? values['bmiRange']
            : '> 1 and < 99',
        'diseases': enabled['diseases'] == true ? values['diseases'] : '',
        'priorMedications': enabled['priorMedications'] == true
            ? values['priorMedications']
            : '',
        'surgeries': enabled['surgeries'] == true ? values['surgeries'] : '',
        'pregnancy':
            enabled['pregnancy'] == true ? values['pregnancy'] : '',
      };
}
