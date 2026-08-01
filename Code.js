// ==UserScript==
// @name         GEOfs Ground speed to air speed converter
// @namespace    https://www.geo-fs.com/
// @version      2.0
// @description  The system instantly displays the airspeed value corresponding to the target ground speed at the current altitude, making it convenient to input the data into the autopilot.
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://beta.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    function waitForGEOfs(cb) {
        const t = setInterval(() => {
            if (typeof geofs !== 'undefined' && geofs.animation && geofs.animation.values) {
                clearInterval(t);
                setTimeout(cb, 1500);
            }
        }, 500);
    }

    // ── ISA 換算函式 ────────────────────────────────────────────────
    function getISATemp(altFt) {
        return altFt <= 36089 ? 288.15 - 0.0019812 * altFt : 216.65;
    }
    function getISADensityRatio(altFt) {
        if (altFt <= 36089) {
            return Math.pow(getISATemp(altFt) / 288.15, 4.2561);
        } else {
            const sigma36 = Math.pow(216.65 / 288.15, 4.2561);
            return sigma36 * Math.exp(-0.0000480636 * (altFt - 36089));
        }
    }
    function gsToIAS(gsKts, altFt) {
        return gsKts * Math.sqrt(getISADensityRatio(altFt));
    }
    function iasToMach(iasKts, altFt) {
        const sigma = getISADensityRatio(altFt);
        const soundSpeed = 38.967 * Math.sqrt(getISATemp(altFt));
        return (iasKts / Math.sqrt(sigma)) / soundSpeed;
    }

    function recalc() {
        const useCustomAlt = document.getElementById('gi-alt-lock').checked;
        const altFt = useCustomAlt
            ? (parseFloat(document.getElementById('gi-alt-input').value) || 0)
            : (geofs.animation.values.altitude || 0);
        const targetGS = parseFloat(document.getElementById('gi-gs-input').value);

        if (!isNaN(targetGS) && targetGS > 0 && altFt >= 0) {
            const ias  = gsToIAS(targetGS, altFt);
            const mach = iasToMach(ias, altFt);
            document.getElementById('gi-result-ias').textContent  = ias.toFixed(0);
            document.getElementById('gi-result-mach').textContent = mach.toFixed(3);
        } else {
            document.getElementById('gi-result-ias').textContent  = '--';
            document.getElementById('gi-result-mach').textContent = '--';
        }
    }

    function buildUI() {
        const panel = document.createElement('div');
        panel.id = 'gs-ias-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 60px;
            right: 36px;
            width: 220px;
            background: rgba(8, 14, 24, 0.88);
            border: 1px solid rgba(79,195,247,0.35);
            border-radius: 8px;
            padding: 10px 14px 12px;
            z-index: 99999;
            font-family: 'Courier New', monospace;
            color: #cde8f7;
            font-size: 12px;
            user-select: none;
            box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="color:#4fc3f7;font-size:11px;letter-spacing:0.08em">✈ GS ↔ IAS 換算</span>
                <span id="gs-ias-close" style="cursor:pointer;color:#888;font-size:14px;line-height:1">✕</span>
            </div>

            <!-- 即時資訊 -->
            <div style="background:rgba(255,255,255,0.05);border-radius:5px;padding:7px 9px;margin-bottom:10px;line-height:1.9">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:#888">高度</span>
                    <div style="display:flex;align-items:center;gap:5px">
                        <span id="gi-alt">-- ft</span>
                        <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#555;font-size:10px">
                            <input type="checkbox" id="gi-alt-lock" style="cursor:pointer;accent-color:#4fc3f7"> 自訂
                        </label>
                    </div>
                </div>
                <!-- 自訂高度輸入（預設隱藏） -->
                <div id="gi-alt-custom-row" style="display:none;margin-top:4px">
                    <div style="display:flex;gap:6px;align-items:center">
                        <input id="gi-alt-input" type="number" min="0" max="60000" placeholder="ft"
                            style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(79,195,247,0.3);
                            border-radius:4px;color:#fff;font-family:inherit;font-size:12px;
                            padding:4px 7px;outline:none;width:0">
                        <span style="color:#555;font-size:10px">ft</span>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#888">當前 GS</span>
                    <span id="gi-gs" style="color:#4fc3f7">-- kts</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#888">當前 IAS</span>
                    <span id="gi-ias">-- kts</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#888">當前 Mach</span>
                    <span id="gi-mach">--</span>
                </div>
            </div>

            <!-- 換算輸入 -->
            <div style="margin-bottom:6px;color:#888;font-size:11px">目標地速 (GS)</div>
            <div style="display:flex;gap:6px;margin-bottom:10px">
                <input id="gi-gs-input" type="number" min="0" max="999" placeholder="例：500"
                    style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(79,195,247,0.3);
                    border-radius:4px;color:#fff;font-family:inherit;font-size:13px;
                    padding:5px 8px;outline:none;width:0">
                <span style="line-height:2.2;color:#555;font-size:11px">kts</span>
            </div>

            <!-- 換算結果 -->
            <div style="background:rgba(79,195,247,0.08);border:1px solid rgba(79,195,247,0.2);
                border-radius:5px;padding:8px 10px;text-align:center">
                <div style="color:#888;font-size:10px;margin-bottom:2px">填入 AP 的空速值</div>
                <div style="display:flex;align-items:baseline;justify-content:center;gap:6px">
                    <span id="gi-result-ias" style="color:#4fc3f7;font-size:22px;font-weight:bold">--</span>
                    <span style="color:#4fc3f7;font-size:12px">kts IAS</span>
                </div>
                <div style="color:#666;font-size:10px;margin-top:2px">
                    ≈ Mach <span id="gi-result-mach">--</span>
                </div>
            </div>

            <div style="margin-top:8px;color:#444;font-size:10px;line-height:1.5;text-align:center">
                換算依當前高度與溫度即時計算
            </div>
        `;

        panel.style.display = 'none'; // 預設縮小
        document.body.appendChild(panel);

        // 關閉按鈕
        document.getElementById('gs-ias-close').onclick = () => {
            panel.style.display = 'none';
            btn.style.display = 'block';
        };

        // 重開按鈕（預設顯示）
        const btn = document.createElement('div');
        btn.style.cssText = `
            position: fixed;
            bottom: 45px;
            right: 60px;
            background: rgba(8,14,24,0.88);
            border: 1px solid rgba(79,195,247,0.35);
            border-radius: 6px;
            padding: 5px 10px;
            color: #4fc3f7;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            cursor: pointer;
            z-index: 99999;
            display: block;
        `;
        btn.textContent = '✈ GS↔IAS';
        btn.onclick = () => { panel.style.display = 'block'; btn.style.display = 'none'; };
        document.body.appendChild(btn);

        // 自訂高度 checkbox 切換
        document.getElementById('gi-alt-lock').addEventListener('change', function() {
            document.getElementById('gi-alt-custom-row').style.display = this.checked ? 'block' : 'none';
            recalc();
        });

        // 自訂高度輸入
        document.getElementById('gi-alt-input').addEventListener('input', recalc);

        // GS 輸入
        document.getElementById('gi-gs-input').addEventListener('input', recalc);

        // 即時顯示更新
        setInterval(() => {
            const v = geofs.animation.values;
            if (!v) return;

            const altFt  = v.altitude || 0;
            const gsKnt  = v.groundSpeedKnt || 0;
            const iasKnt = v.kias || 0;
            const mach   = v.mach || 0;

            // 高度顯示：如果自訂模式就顯示自訂值
            const useCustom = document.getElementById('gi-alt-lock').checked;
            if (!useCustom) {
                document.getElementById('gi-alt').textContent = altFt.toFixed(0) + ' ft';
            } else {
                const customAlt = parseFloat(document.getElementById('gi-alt-input').value) || 0;
                document.getElementById('gi-alt').textContent = customAlt.toFixed(0) + ' ft ✎';
            }

            document.getElementById('gi-gs').textContent   = gsKnt.toFixed(1) + ' kts';
            document.getElementById('gi-ias').textContent  = iasKnt.toFixed(1) + ' kts';
            document.getElementById('gi-mach').textContent = mach.toFixed(3);

            // 非自訂模式下隨高度即時重算
            if (!useCustom) recalc();
        }, 200);
    }

    waitForGEOfs(buildUI);
})();
