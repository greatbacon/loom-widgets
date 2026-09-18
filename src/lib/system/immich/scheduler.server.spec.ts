import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	PGHOST: 'localhost',
	PGPORT: '5432',
	PGDATABASE: 'test',
	PGUSER: 'test',
	PGPASSWORD: 'test'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const sqlEnd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const postgresFactory = vi.hoisted(() => vi.fn(() => ({ end: sqlEnd })));

vi.mock('postgres', () => ({ default: postgresFactory }));

const processUnprocessedAssets = vi.hoisted(() => vi.fn());
const cycleActiveAsset = vi.hoisted(() => vi.fn());
const pictureFrameServiceConstructor = vi.hoisted(() => vi.fn());

vi.mock('./pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService(...args: unknown[]) {
		pictureFrameServiceConstructor(...args);
		return { processUnprocessedAssets, cycleActiveAsset };
	})
}));

vi.mock('./processedImagesRepo', () => ({
	ProcessedImagesRepo: vi.fn().mockImplementation(function ProcessedImagesRepo(sql: unknown) {
		return { sql };
	})
}));

const cronConstructor = vi.hoisted(() => vi.fn());

vi.mock('croner', () => ({
	Cron: vi.fn().mockImplementation(function Cron(...args: unknown[]) {
		cronConstructor(...args);
	})
}));

const { runNightlyPictureFrameBatch, startNightlyPictureFrameScheduler } = await import(
	'./scheduler.server'
);

describe('runNightlyPictureFrameBatch', () => {
	beforeEach(() => {
		postgresFactory.mockClear();
		sqlEnd.mockClear().mockResolvedValue(undefined);
		processUnprocessedAssets.mockReset();
		cycleActiveAsset.mockReset();
		pictureFrameServiceConstructor.mockClear();
	});

	it('runs the batch through a PictureFrameService built from its own connection, then closes it', async () => {
		processUnprocessedAssets.mockResolvedValue({
			ok: true,
			data: { processedCount: 2, failedCount: 0 },
			code: 200
		});
		cycleActiveAsset.mockResolvedValue({
			ok: true,
			data: { status: 'pushed' },
			code: 200
		});

		await runNightlyPictureFrameBatch();

		expect(postgresFactory).toHaveBeenCalledTimes(1);
		expect(pictureFrameServiceConstructor).toHaveBeenCalledWith(undefined, undefined, {
			sql: expect.anything()
		});
		expect(processUnprocessedAssets).toHaveBeenCalled();
		expect(cycleActiveAsset).toHaveBeenCalled();
		expect(sqlEnd).toHaveBeenCalledTimes(1);
	});

	it('logs the error and still closes the connection when the batch returns a non-ok result', async () => {
		processUnprocessedAssets.mockResolvedValue({
			ok: false,
			error: 'Failed to auto-process album assets',
			code: 502
		});

		await runNightlyPictureFrameBatch();

		expect(cycleActiveAsset).not.toHaveBeenCalled();
		expect(sqlEnd).toHaveBeenCalledTimes(1);
	});

	it('still closes the connection when processUnprocessedAssets rejects', async () => {
		processUnprocessedAssets.mockRejectedValue(new Error('unexpected'));

		await expect(runNightlyPictureFrameBatch()).rejects.toThrow('unexpected');

		expect(sqlEnd).toHaveBeenCalledTimes(1);
	});

	it('logs the cycle error and still closes the connection when cycleActiveAsset returns a non-ok result', async () => {
		processUnprocessedAssets.mockResolvedValue({
			ok: true,
			data: { processedCount: 0, failedCount: 0 },
			code: 200
		});
		cycleActiveAsset.mockResolvedValue({
			ok: false,
			error: 'No processed assets available to cycle',
			code: 409
		});

		await runNightlyPictureFrameBatch();

		expect(sqlEnd).toHaveBeenCalledTimes(1);
	});

	it('still closes the connection when cycleActiveAsset rejects', async () => {
		processUnprocessedAssets.mockResolvedValue({
			ok: true,
			data: { processedCount: 0, failedCount: 0 },
			code: 200
		});
		cycleActiveAsset.mockRejectedValue(new Error('unexpected'));

		await expect(runNightlyPictureFrameBatch()).rejects.toThrow('unexpected');

		expect(sqlEnd).toHaveBeenCalledTimes(1);
	});
});

describe('startNightlyPictureFrameScheduler', () => {
	beforeEach(() => {
		cronConstructor.mockClear();
	});

	it('schedules the job for server-local midnight with overlap protection', () => {
		startNightlyPictureFrameScheduler();

		expect(cronConstructor).toHaveBeenCalledWith(
			'0 0 * * *',
			expect.objectContaining({ protect: true }),
			expect.any(Function)
		);
	});
});
