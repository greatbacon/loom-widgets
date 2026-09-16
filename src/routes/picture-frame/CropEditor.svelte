<script lang="ts">
	import { Dialog, Button } from 'svelte-ux';
	import type { CropRect } from '$lib/system/immich/pictureFrame';

	let {
		open = $bindable(false),
		assetId,
		aspectRatio,
		onconfirm,
		oncancel
	}: {
		open?: boolean;
		assetId: string;
		aspectRatio: number;
		onconfirm: (crop: CropRect) => void;
		oncancel?: () => void;
	} = $props();

	let imgEl = $state<HTMLImageElement | undefined>(undefined);
	let renderedWidth = $state(0);
	let renderedHeight = $state(0);
	let box = $state({ x: 0, y: 0, width: 0, height: 0 });

	let dragMode: 'move' | 'resize' | null = null;
	let dragStart = { pointerX: 0, pointerY: 0, box: { x: 0, y: 0, width: 0, height: 0 } };

	function initBox() {
		if (!imgEl) return;
		renderedWidth = imgEl.clientWidth;
		renderedHeight = imgEl.clientHeight;

		let width = renderedWidth;
		let height = width / aspectRatio;
		if (height > renderedHeight) {
			height = renderedHeight;
			width = height * aspectRatio;
		}

		box = {
			x: (renderedWidth - width) / 2,
			y: (renderedHeight - height) / 2,
			width,
			height
		};
	}

	function clampBox(next: { x: number; y: number; width: number; height: number }) {
		const width = Math.min(Math.max(next.width, 20), renderedWidth);
		const height = width / aspectRatio;
		const x = Math.min(Math.max(next.x, 0), renderedWidth - width);
		const y = Math.min(Math.max(next.y, 0), renderedHeight - height);
		return { x, y, width, height };
	}

	function startMove(e: PointerEvent) {
		e.preventDefault();
		dragMode = 'move';
		dragStart = { pointerX: e.clientX, pointerY: e.clientY, box: { ...box } };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function startResize(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragMode = 'resize';
		dragStart = { pointerX: e.clientX, pointerY: e.clientY, box: { ...box } };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragMode) return;
		const dx = e.clientX - dragStart.pointerX;
		const dy = e.clientY - dragStart.pointerY;

		if (dragMode === 'move') {
			box = clampBox({
				...dragStart.box,
				x: dragStart.box.x + dx,
				y: dragStart.box.y + dy
			});
		} else {
			box = clampBox({ ...dragStart.box, width: dragStart.box.width + dx });
		}
	}

	function handlePointerUp() {
		dragMode = null;
	}

	function handleConfirm() {
		if (!imgEl || renderedWidth === 0) return;
		const scale = imgEl.naturalWidth / renderedWidth;
		onconfirm({
			x: Math.round(box.x * scale),
			y: Math.round(box.y * scale),
			width: Math.round(box.width * scale),
			height: Math.round(box.height * scale)
		});
	}

	function handleClose() {
		oncancel?.();
	}
</script>

<Dialog bind:open on:close={handleClose} classes={{ dialog: 'max-w-3xl' }}>
	<div slot="title">Crop photo</div>
	<div class="flex flex-col gap-4 p-4">
		<div
			class="relative mx-auto touch-none select-none"
			role="presentation"
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
		>
			<img
				bind:this={imgEl}
				src={`/picture-frame/original/${assetId}`}
				alt="Original, uncropped"
				class="block max-h-[60vh] max-w-full"
				onload={initBox}
			/>
			<div
				class="absolute cursor-move border-2 border-primary bg-primary/20"
				style:left="{box.x}px"
				style:top="{box.y}px"
				style:width="{box.width}px"
				style:height="{box.height}px"
				role="presentation"
				onpointerdown={startMove}
			>
				<div
					class="absolute -right-2 -bottom-2 h-4 w-4 cursor-se-resize rounded-full bg-primary"
					role="presentation"
					onpointerdown={startResize}
				></div>
			</div>
		</div>
	</div>
	<div slot="actions" class="flex justify-end gap-2 p-4">
		<Button on:click={() => (open = false)}>Cancel</Button>
		<Button variant="fill" color="primary" on:click={handleConfirm}>Confirm crop</Button>
	</div>
</Dialog>
