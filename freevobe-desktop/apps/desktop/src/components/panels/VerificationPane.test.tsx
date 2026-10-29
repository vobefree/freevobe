// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, VerificationCommand, VerificationReport } from '@freevobe/protocol';
import { VerificationPane } from './VerificationPane';
import { useAppStore } from '../../store/appStore';

const commands: VerificationCommand[] = [
  {
    id: 'typecheck',
    label: 'Typkontroll',
    kind: 'typecheck',
    command: 'npm run typecheck --silent',
    source: 'package.json',
  },
  {
    id: 'test',
    label: 'Tester',
    kind: 'test',
    command: 'npm run test --silent',
    source: 'package.json',
  },
];

const report: VerificationReport = {
  id: 'verify_1',
  projectId: 'proj_1',
  sessionId: 'sess_1',
  runId: 'run_1',
  trigger: 'run',
  status: 'failed',
  summary: '1 av 2 steg röda: Tester (1,4 s).',
  startedAt: 1_000,
  finishedAt: 1_400,
  durationMs: 400,
  checks: [
    {
      ...commands[0]!,
      status: 'passed',
      exitCode: 0,
      durationMs: 120,
      output: 'inga typfel',
    },
    {
      ...commands[1]!,
      status: 'failed',
      exitCode: 1,
      durationMs: 280,
      output: 'Tests  1 failed | 3 passed',
      passed: 3,
      failed: 1,
    },
  ],
};

const project = {
  id: 'proj_1',
  path: 'C:/projekt',
  name: 'projekt',
  permissionMode: 'ask',
  createdAt: 1,
  lastOpenedAt: 2,
} as Project;

function reset() {
  useAppStore.setState({
    verification: null,
    verificationCommands: [],
    verificationProgress: [],
    verificationRunning: false,
    project: null,
    rightTab: 'diff',
    client: null,
    logs: [],
  });
}

describe('VerificationPane', () => {
  afterEach(() => {
    cleanup();
    reset();
  });

  it('visar rapporten med stegen, tiderna och testantalet', () => {
    useAppStore.setState({
      verification: report,
      verificationCommands: commands,
      project,
    });
    render(<VerificationPane />);

    expect(screen.getByTestId('verification-report').textContent).toContain('röda steg');
    expect(screen.getByTestId('verification-commands').textContent).toContain('Typkontroll');
    const text = screen.getByTestId('verification-report').textContent ?? '';
    expect(text).toContain('3 gröna, 1 röda');
    // Det röda steget är utfällt och visar utdata direkt.
    expect(text).toContain('Tests  1 failed | 3 passed');
  });

  it('kör verifieringen mot API:t', async () => {
    const post = vi.fn(async () => report as never);
    const get = vi.fn(
      async (url: string) => (url.includes('/verifications') ? [report] : { commands }) as never,
    );
    useAppStore.setState({
      verificationCommands: commands,
      project,
      client: { post, get } as never,
    });

    render(<VerificationPane />);
    fireEvent.click(screen.getByTestId('run-verification'));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects/proj_1/verification', {}));
    await waitFor(() => expect(useAppStore.getState().verification?.id).toBe('verify_1'));
    expect(useAppStore.getState().rightTab).toBe('verify');
  });

  it('visar pågående steg medan verifieringen körs', () => {
    useAppStore.setState({
      project,
      verificationRunning: true,
      verificationCommands: commands,
      verificationProgress: [{ ...report.checks[0]!, status: 'passed' }],
    });

    render(<VerificationPane />);

    expect(screen.getByTestId('verification-progress').textContent).toContain('Typkontroll');
    expect(screen.getByTestId('run-verification')).toHaveProperty('disabled', true);
  });

  it('förklarar när projektet saknar verifieringssteg', () => {
    useAppStore.setState({ project });
    render(<VerificationPane />);
    expect(screen.getByText(/Inga verifieringssteg hittades/)).toBeTruthy();
  });
});
