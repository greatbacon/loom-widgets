export interface PictureFrameAsset {
	id: string;
	filename: string;
	takenAt: string;
	type: string;
	thumbnailUrl: string;
	originalUrl: string;
	processed: boolean;
}

export interface PictureFrameAlbum {
	albumId: string;
	albumName: string;
	assets: PictureFrameAsset[];
}

export interface PictureFramePushResult {
	asset: {
		id: string;
		filename: string;
	};
	device: {
		width: number;
		height: number;
	};
	path: string;
}

export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ProcessedImageRow {
	asset_id: string;
	filename: string;
	crop_x: number;
	crop_y: number;
	crop_width: number;
	crop_height: number;
	device_width: number;
	device_height: number;
	file_path: string;
	created_at: Date;
	updated_at: Date | null;
}

export interface PictureFrameProcessResult {
	asset: { id: string; filename: string };
	crop: CropRect;
	device: { width: number; height: number };
}
