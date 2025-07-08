let map;
let userMarker; // 用于标记用户位置
let queryMarker; // 用于标记查询结果的位置
let queryLine; // 用于连接两个位置的线

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
    getUserLocation();
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
                const userLocation = [latitude, longitude];

                map.setView(userLocation, 16);

                // 如果已有用户标记，先移除
                if (userMarker) {
                    userMarker.remove();
                }

                // 添加新的用户标记
                userMarker = L.marker(userLocation).addTo(map)
                    .bindPopup("<b>您的位置</b>").openPopup();
            },
            (error) => {
                console.error("Error getting user's location:", error);
            }
        );
    } else {
        console.error("Geolocation is not supported by this browser.");
    }
}

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

function getResultData() {
    fetch("https://ipv4_ct.itdog.cn")
        .then((response) => response.json())
        .then((data) => {
            const ip = data.ip;
            return fetch(`https://ipwho.is/${ip}`);
        })
        .then((response) => response.json())
        .then((info) => {
            const resultElem = document.getElementById("result");
            resultElem.textContent = `${info.ip} ${info.region} ${info.city} ${info.connection?.org}`;
        })
        .catch((error) => console.error("Error getting result data:", error));
}


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


function displayResult(data, input) {
    const resultContainer = document.getElementById("query-result-container");
    resultContainer.innerHTML =
        `<p>IP 地址：${input}</p>` +
        `<p>归属地：${data.city}, ${data.region}, ${data.country_name}</p>` +
        `<p>运营商：${data.org}</p>`;

    if (!data.latitude || !data.longitude) {
        console.warn("缺少坐标信息，无法在地图上显示。");
        return;
    }

    const targetLocation = [data.latitude, data.longitude];

    // 移除上一次的查询标记和连接线
    if (queryMarker) {
        queryMarker.remove();
    }
    if (queryLine) {
        queryLine.remove();
    }

    // 添加新的查询标记
    queryMarker = L.marker(targetLocation).addTo(map);

    // 获取用户当前位置，以计算距离并绘制连接线
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const userLocation = [latitude, longitude];

                // 如果用户标记已存在，更新其位置，否则创建一个新的
                if (userMarker) {
                    userMarker.setLatLng(userLocation);
                } else {
                    userMarker = L.marker(userLocation).addTo(map).bindPopup("<b>您的位置</b>");
                }
                
                // 计算距离并更新查询标记的弹窗内容
                const distance = getDistance(latitude, longitude, data.latitude, data.longitude);
                const popupContent = `<b>查询结果</b><br>距您 ${distance} 公里`;
                queryMarker.bindPopup(popupContent).openPopup();

                // 绘制连接您和查询位置的线
                queryLine = L.polyline([userLocation, targetLocation], {
                    color: 'blue',
                    weight: 3,
                    opacity: 0.7
                }).addTo(map);

                // 自动调整地图视野，以完整显示两个点和它们之间的线
                map.fitBounds(queryLine.getBounds(), { padding: [50, 50] });
            },
            (error) => {
                // 如果获取用户位置失败，则仅显示查询结果的位置
                console.error("获取当前位置失败：", error);
                queryMarker.bindPopup("<b>查询结果</b>").openPopup();
                map.setView(targetLocation, 12);
            }
        );
    } else {
        // 如果浏览器不支持地理定位，也仅显示查询结果的位置
        console.warn("浏览器不支持定位");
        queryMarker.bindPopup("<b>查询结果</b>").openPopup();
        map.setView(targetLocation, 12);
    }

    saveToHistory(input);
}


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

            // 使用 queryMarker 来显示地理搜索结果
            if (queryMarker) {
                queryMarker.remove();
            }
             // 如果有连接线，也一并移除
            if (queryLine) {
                queryLine.remove();
            }
            queryMarker = L.marker(coordinates).addTo(map).bindPopup(location.display_name).openPopup();
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
