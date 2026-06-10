import type {HeifImage, LibHeifModule} from "libheif-js/libheif-wasm/libheif-bundle.mjs";

type DecodeBuffer = ArrayBuffer

const uint8ArrayUtf8ByteString = (array: DecodeBuffer, start: number, end: number) => {
    const arr = new Uint8Array(array)

    return String.fromCharCode(...arr.slice(start, end));
};

// brands explained: https://github.com/strukturag/libheif/issues/83
// code adapted from: https://github.com/sindresorhus/file-type/blob/6f901bd82b849a85ca4ddba9c9a4baacece63d31/core.js#L428-L438
const isHeic = (buffer: DecodeBuffer) => {
    const brandMajor = uint8ArrayUtf8ByteString(buffer, 8, 12).replace('\0', ' ').trim();

    switch (brandMajor) {
        case 'mif1':
            return true; // {ext: 'heic', mime: 'image/heif'};
        case 'msf1':
            return true; // {ext: 'heic', mime: 'image/heif-sequence'};
        case 'heic':
        case 'heix':
            return true; // {ext: 'heic', mime: 'image/heic'};
        case 'hevc':
        case 'hevx':
            return true; // {ext: 'heic', mime: 'image/heic-sequence'};
    }

    return false;
};

const decodeImage = async (image: HeifImage) => {
    const width = image.get_width();
    const height = image.get_height();

    const { data } = await new Promise<{ data: Uint8ClampedArray }>((resolve, reject) => {
        image.display({ data: new Uint8ClampedArray(width*height*4), width, height }, (displayData) => {

            if (!displayData) {
                return reject(new Error('HEIF processing error'));
            }

            resolve(displayData);
        });
    });

    return { width, height, data };
};

export function decodeHeicInit(libheif: LibHeifModule) {
    const decodeBuffer = async (buffer: DecodeBuffer) => {
        if (!isHeic(buffer)) {
            throw new TypeError('input buffer is not a HEIC image');
        }

        // wait for module to be initialized
        // currently it is synchronous but it might be async in the future
        await libheif.ready;

        const decoder = new libheif.HeifDecoder();
        const data = decoder.decode(buffer);

        const dispose = () => {
            for (const image of data) {
                image.free();
            }

            decoder.decoder.delete();
        };

        if (!data.length) {
            throw new Error('HEIF image not found');
        }

        return Object.defineProperty(data.map(image => {
            return {
                width: image.get_width(),
                height: image.get_height(),
                decode: async () => await decodeImage(image)
            };
        }), 'dispose', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: dispose
        });
    };

    const decodeOne = async (buffer: ArrayBuffer) => {
        if (!isHeic(buffer)) {
            throw new TypeError('input buffer is not a HEIC image');
        }

        // wait for module to be initialized
        // currently it is synchronous but it might be async in the future
        await libheif.ready;

        const decoder = new libheif.HeifDecoder();
        const data = decoder.decode(buffer);

        const dispose = () => {
            for (const image of data) {
                image.free();
            }

            decoder.decoder.delete();
        };

        if (!data.length) {
            throw new Error('HEIF image not found');
        }

        try {
            return await decodeImage(data[0]);
        } finally {
            dispose();
        }
    }

    return {
        one: async ({ buffer }: { buffer: DecodeBuffer }) => await decodeOne(buffer),
        all: async ({ buffer }: { buffer: DecodeBuffer }) => await decodeBuffer(buffer)
    };
}

export async function heicDecode(buffer: ArrayBuffer) {
    const lib = (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')).default

    const { one } = decodeHeicInit(lib())

    return await one({ buffer })
}
