import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class EnterNameScreen extends StatefulWidget {
  const EnterNameScreen({super.key});

  @override
  State<EnterNameScreen> createState() => _EnterNameScreenState();
}

class _EnterNameScreenState extends State<EnterNameScreen> {
  late final TextEditingController _nameCtrl;
  bool _shareName = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final ctrl = context.read<BusTrackerController>();
    _nameCtrl = TextEditingController(text: ctrl.userName);
    _shareName = ctrl.shareName;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Please enter at least 2 characters.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final ctrl = context.read<BusTrackerController>();
      await ctrl.saveProfile(name, shareName: _shareName);
      ctrl.navigateTo(AppRouteScreen.locationPermission);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.read<BusTrackerController>();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => ctrl.navigateTo(AppRouteScreen.welcome),
        ),
        title: const Text('Commuter Identity'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'What should riders call you?',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              const Text(
                'No passwords or email verification needed. Enter your first name or nickname to join a live bus corridor.',
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _nameCtrl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Your Name',
                  hintText: 'e.g., Maya or Alex',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 16),
              Card(
                child: SwitchListTile(
                  value: _shareName,
                  onChanged: (v) => setState(() => _shareName = v),
                  title: const Text(
                    'Display my name to other riders',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Turn off to appear anonymously as Commuter ID in passenger lists.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: AppColors.danger, fontSize: 13),
                ),
              ],
              const Spacer(),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(_submitting ? 'Saving...' : 'Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
