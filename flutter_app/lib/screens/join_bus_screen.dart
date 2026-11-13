import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/bus_models.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class JoinBusScreen extends StatefulWidget {
  const JoinBusScreen({super.key});

  @override
  State<JoinBusScreen> createState() => _JoinBusScreenState();
}

class _JoinBusScreenState extends State<JoinBusScreen> {
  final _codeCtrl = TextEditingController();
  final _busNameCtrl = TextEditingController();
  final _routeNameCtrl = TextEditingController();
  bool _joining = false;
  bool _showCreate = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BusTrackerController>().refreshSessions();
    });
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _busNameCtrl.dispose();
    _routeNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _join(String codeOrId) async {
    if (codeOrId.trim().isEmpty) return;
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      await context.read<BusTrackerController>().joinBusSession(codeOrId);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  Future<void> _createSession() async {
    final name = _busNameCtrl.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Enter a bus or shuttle name.');
      return;
    }
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      await context.read<BusTrackerController>().createAndJoinSession(
            sessionName: name,
            routeName: _routeNameCtrl.text.trim().isNotEmpty
                ? _routeNameCtrl.text.trim()
                : 'Community Corridor',
          );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<BusTrackerController>();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () =>
              ctrl.navigateTo(AppRouteScreen.locationPermission),
        ),
        title: Text('Hi, ${ctrl.userName}'),
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.tune_rounded),
            onPressed: () => ctrl.navigateTo(AppRouteScreen.settings),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: ctrl.refreshSessions,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Join a live bus session',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enter a route code shared by another commuter or pick an active bus below.',
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _codeCtrl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      hintText: 'Session code (e.g. 38R-SF)',
                      prefixIcon: Icon(Icons.tag_rounded),
                    ),
                    onSubmitted: _join,
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  onPressed: _joining ? null : () => _join(_codeCtrl.text),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(84, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Join'),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.danger, fontSize: 13),
                ),
              ),
            ],
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Active Corridors',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                TextButton.icon(
                  onPressed: () => setState(() => _showCreate = !_showCreate),
                  icon: Icon(_showCreate ? Icons.close : Icons.add_rounded),
                  label: Text(_showCreate ? 'Cancel' : 'New Bus'),
                ),
              ],
            ),
            if (_showCreate) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Start a New Bus Session',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _busNameCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Bus Name / Number',
                          hintText: 'e.g., Campus Loop Express #4',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _routeNameCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Route Description',
                          hintText: 'e.g., North Gate → Union Station',
                        ),
                      ),
                      const SizedBox(height: 14),
                      FilledButton(
                        onPressed: _joining ? null : _createSession,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(double.infinity, 48),
                        ),
                        child: Text(
                          _joining ? 'Creating...' : 'Create & Start Tracking',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (ctrl.loadingSessions && ctrl.availableSessions.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              ...ctrl.availableSessions.map(
                (s) => _SessionCard(
                  session: s,
                  onTap: _joining ? null : () => _join(s.id),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session, required this.onTap});
  final BusSession session;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.cobalt.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        session.sessionCode,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.cobalt,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const Spacer(),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  session.sessionName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  session.routeName,
                  style: TextStyle(
                    fontSize: 13,
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF94A3B8)
                        : const Color(0xFF475569),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '${session.sharingCount} sharing GPS · ${session.waitingCount} waiting · ${session.onboardCount} onboard',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: session.sharingCount > 0
                        ? AppColors.emerald
                        : const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
