let map;
let userMarker;     // 用于标记用户位置
let queryMarker;    // 用于标记查询结果的位置
let queryLine;      // 用于连接两个位置的线
let userLocation = null; // 用于存储用户位置坐标

// 【新增】定义一个自定义的红色小图标
const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [20, 33],      // 尺寸比默认(25x41)小一点
    iconAnchor: [10, 33],    // 锚点位置调整
    popupAnchor: [1, -30],   // 弹出窗口的锚点调整
    shadowSize: [33, 33]     // 阴影大小调整
});

function loadMapScenario() {
    // 1. 定义不同的地图图层
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, etc.'
    });

    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    // 2. 初始化地图，并默认加载卫星地图
    map = L.map('map-container', {
        center: [39.9042, 116.4074],
        zoom: 5,
        layers: [satelliteMap] // 默认显示的图层
    });

    // 3. 创建图层组，用于切换控件
    const baseLayers = {
        "卫星地图": satelliteMap,
        "街道地图": streetMap
    };

    // 4. 添加图层切换控件到地图上
    L.control.layers(baseLayers).addTo(map);
    
    // 原有的功能函数
    getUserLocation(); // 在页面加载时获取一次用户位置
    getUserIP();
    getBlockedSiteIP();
    getResultData();
    updateHistoryList();
}


function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                userLocation = [latitude, longitude]; 

                map.setView(userLocation, 16);

                if (userMarker) {
                    userMarker.remove();
                }

                // 【修改】使用新的红色小图标来标记用户位置
                userMarker = L.marker(userLocation, { icon: redIcon }).addTo(map)
                    .bindPopup("<b>您的位置</b>").openPopup();
            },
            (error) => {
                console.error("无法获取您的位置，距离信息将不可用:", error.message);
            }
        );
    } else {
        console.error("您的浏览器不支持地理定位功能。");
    }
}

// ... getUserIP, getBlockedSiteIP... 函数保持不变 ...
function getUserIP() {
    fetch("https://ipapi.co/json/")
        .then((response) => response.json())
        .then((data) => {
            const userIpElem = document.getElementById("user-ip");
            userIpElem.textContent = `${data.ip} ${data.country} ${data.city}`;
        })
        .catch((error) => console.error(error));
}

function getBlockedSiteIP() {
    fetch("https://ipleak.net/json/")
        .then((response) => response.json())
        .then((data) => {
            const blockedSiteIpElem = document.getElementById("blocked-site-ip");
            blockedSiteIpElem.textContent = `${data.ip} ${data.country_name}`;
        })
        .catch((error) => console.error(error));
}



// 【最终正确版本】完全按照您的要求，只使用 ipv4_ct.itdog.cn
function getResultData() {
    fetch("https://ipv4_ct.itdog.cn")
        .then(response => {
            if (!response.ok) {
                throw new Error(`网络响应失败: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const resultElem = document.getElementById("result");
            if (data.type === 'success' && data.ip && data.address) {
                const displayText = `${data.ip} ${data.address.replace(/\//g, " ")}`;
                resultElem.textContent = displayText;
            } else {
                const errorMsg = data.message || '返回数据格式不正确';
                console.error("itdog API error:", errorMsg);
                resultElem.textContent = `获取国内 IP 信息失败: ${errorMsg}`;
            }
        })
        .catch(error => {
            console.error("获取国内 IP 数据时出错:", error);
            const resultElem = document.getElementById("result");
            resultElem.textContent = "获取国内 IP 信息失败，请检查网络或浏览器控制台。";
        });
}

// ... 您文件中的其他函数保持不变 ...



function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d.toFixed(2);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}


function getDNSInfo() {
    const input = document.getElementById("domain-input").value.trim();
    if (!input) return;

    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(input);
    const isIPv6 = /^[a-fA-F0-9:]+$/.test(input);

    const fetchIPData = (ip) => fetch(`https://ipapi.co/${ip}/json/`).then(response => response.json());

    const fetchDomainData = async (domain) => {
        let response = await fetch(`https://dns.alidns.com/resolve?name=${domain}&type=A`);
        let data = await response.json();
        if (!data.Answer || data.Answer.length === 0) {
            response = await fetch(`https://dns.alidns.com/resolve?name=${domain}&type=AAAA`);
            data = await response.json();
        }
        return data;
    };

    if (isIPv4 || isIPv6) {
        fetchIPData(input)
            .then(data => displayResult(data, input))
            .catch(error => {
                console.error("查询 IP 出错：", error);
                document.getElementById("query-result-container").innerHTML = "<p>查询失败，请输入有效的 IP 地址。</p>";
            });
    } else {
        fetchDomainData(input)
            .then(data => {
                if (!data.Answer || data.Answer.length === 0) throw new Error("无解析记录");
                const ipAddress = data.Answer[0].data;
                return fetchIPData(ipAddress);
            })
            .then(ipData => displayResult(ipData, ipData.ip))
            .catch(error => {
                console.error("查询域名出错：", error);
                document.getElementById("query-result-container").innerHTML = "<p>查询失败，请输入有效的域名。</p>";
            });
    }
}


// 【重点修改区域】
function displayResult(data, input) {
    const resultContainer = document.getElementById("query-result-container");
    resultContainer.innerHTML =
        `<p>IP 地址：${data.ip || input}</p>` +
        `<p>归属地：${data.city || 'N/A'}, ${data.region || 'N/A'}, ${data.country_name || 'N/A'}</p>` +
        `<p>运营商：${data.org || 'N/A'}</p>`;

    if (!data.latitude || !data.longitude) {
        console.warn("查询结果缺少坐标信息，无法在地图上显示。");
        if (queryMarker) queryMarker.remove();
        if (queryLine) queryLine.remove();
        return;
    }

    const targetLocation = [data.latitude, data.longitude];

    if (queryMarker) queryMarker.remove();
    if (queryLine) queryLine.remove();
    
    // 【修改】使用新的红色小图标来标记查询结果
    queryMarker = L.marker(targetLocation, { icon: redIcon }).addTo(map);

    if (userLocation) {
        const distance = getDistance(userLocation[0], userLocation[1], data.latitude, data.longitude);
        const popupContent = `<b>查询结果</b><br>距您 ${distance} 公里`;
        queryMarker.bindPopup(popupContent).openPopup();

        // 【修改】绘制红色的弧形连接线
        // 1. 计算控制点以形成弧线
        const midPoint = [(userLocation[0] + targetLocation[0]) / 2, (userLocation[1] + targetLocation[1]) / 2];
        const latDiff = targetLocation[0] - userLocation[0];
        const lngDiff = targetLocation[1] - userLocation[1];
        const k = 0.2; // 控制弧线弯曲程度的系数
        const controlPoint = [
            midPoint[0] + k * lngDiff, // 纬度偏移
            midPoint[1] - k * latDiff  // 经度偏移
        ];

        // 2. 使用 L.curve 绘制弧线
        queryLine = L.curve(
            ['M', userLocation, 'Q', controlPoint, targetLocation], {
                color: 'red', // 颜色改为红色
                weight: 3,
                opacity: 0.7
            }
        ).addTo(map);

        const bounds = L.latLngBounds([userLocation, targetLocation]);
        map.fitBounds(bounds, { padding: [50, 50] });

    } else {
        console.warn("用户位置未知，仅显示查询目标。");
        queryMarker.bindPopup("<b>查询结果</b>").openPopup();
        map.setView(targetLocation, 12);
    }
    saveToHistory(input);
}


// ... saveToHistory, updateHistoryList, searchLocationOnMap 和 事件监听器 保持不变 ...
function saveToHistory(query) {
    let history = JSON.parse(localStorage.getItem("queryHistory")) || [];
    if (!history.includes(query)) {
        history.push(query);
        localStorage.setItem("queryHistory", JSON.stringify(history));
        updateHistoryList();
    }
}

function updateHistoryList() {
    const history = JSON.parse(localStorage.getItem("queryHistory")) || [];
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = "";
    history.forEach((item) => {
        const option = document.createElement("option");
        option.value = item;
        historyList.appendChild(option);
    });
}

async function searchLocationOnMap() {
    const input = document.getElementById("domain-input").value.trim();
    if (input === "") return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const location = data[0];
            const coordinates = [parseFloat(location.lat), parseFloat(location.lon)];
            map.setView(coordinates, 12);

            if (queryMarker) {
                queryMarker.remove();
            }
            if (queryLine) {
                queryLine.remove();
            }
            // 【修改】同样在这里使用红色图标
            queryMarker = L.marker(coordinates, { icon: redIcon }).addTo(map).bindPopup(location.display_name).openPopup();
        }
    } catch (error) {
        console.error('Error with location search:', error);
    }
}

window.addEventListener("load", () => {
    setTimeout(loadMapScenario, 0); 
    
    const domainInput = document.getElementById("domain-input");
    domainInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            getDNSInfo();
        }
    });
});
