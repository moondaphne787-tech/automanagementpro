import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    base: './',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                assetFileNames: function (assetInfo) {
                    var _a;
                    // 固定 WASM 文件名，不带 hash
                    if ((_a = assetInfo.name) === null || _a === void 0 ? void 0 : _a.endsWith('.wasm')) {
                        return 'assets/[name][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                }
            }
        }
    },
    server: {
        port: 5173,
        strictPort: true, // 端口被占用时报错而不是自动切换
    },
});
