export interface PictureFrameAsset {
	id: string;
	filename: string;
	takenAt: string;
	type: string;
	thumbnailUrl: string;
	originalUrl: string;
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
