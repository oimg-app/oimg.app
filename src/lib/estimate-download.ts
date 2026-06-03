
const networks = {
    "3G": {
        rttMs: 270,
        downlinkBps: 700_000      // 700 Kbps
    },
    "4G": {
        rttMs: 20,
        downlinkBps: 10_000_000   // 10 Mbps
    }
} as const

type Network = keyof typeof networks

export function estimateDownloadTime(buffer?: ArrayBuffer | null) {

    const result: Record<Network, number> = {
        "3G": 0,
        "4G": 0
    } as const

    if (!buffer) return result;

    const sizeBytes = buffer.byteLength;
    const sizeBits = sizeBytes * 8;


    for (const entry of Object.entries(networks)) {
        const [net, { rttMs, downlinkBps }] = entry;
        // Время передачи данных (в секундах) = биты / скорость (бит/с)
        const transferSec = sizeBits / downlinkBps;
        // Переводим в миллисекунды и добавляем RTT
        const totalMs = rttMs + transferSec * 1000;
        result[net as Network] = Math.round(totalMs); // округляем до целых мс
    }

    return result;
}
