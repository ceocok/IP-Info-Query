let map;
let userMarker;     // 用于标记用户位置
let queryMarker;    // 用于标记查询结果的位置
let queryLine;      // 用于连接两个位置的线
let userLocation = null; // **【新增】** 用于存储用户位置坐标，这是解决问题的关键

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

    // **【新增功能开始】**
    // 5. 创建并添加一个自定义的“定位我的位置”按钮
    L.Control.Locate = L.Control.extend({
        onAdd: function(map) {
            // 创建一个 div 容器，并赋予它 Leaflet 的标准样式类
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const link = L.DomUtil.create('a', 'leaflet-control-locate', container);
            link.href = '#';
            link.title = '定位我的位置'; // 鼠标悬停时显示的文字

            // 阻止点击事件冒泡到地图
            L.DomEvent.on(link, 'click', L.DomEvent.stopPropagation)
                      .on(link, 'click', L.DomEvent.preventDefault)
                      .on(link, 'click', () => {
                          // 按钮点击逻辑：
                          if (userLocation) {
                              // 如果我们已经知道了用户位置，就平滑地飞过去
                              map.flyTo(userLocation, 16); // 16是缩放级别
                          } else {
                              // 如果还不知道，就调用函数去获取
                              getUserLocation();
                          }
                      });
            
            return container;
        }
    });

    // 将新创建的控件添加到地图的左下角
    new L.Control.Locate({ position: 'bottomleft' }).addTo(map);
    // **【新增功能结束】**
    
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
                // **【修改】** 将获取到的位置存储在全局变量中
                userLocation = [latitude, longitude]; 

                map.setView(userLocation, 16);

                if (userMarker) {
                    userMarker.remove();
                }

                userMarker = L.marker(userLocation).addTo(map)
                    .bindPopup("<b>您的位置</b>").openPopup();
            },
            (error) => {
                // 如果获取失败，userLocation 将保持为 null
                console.error("无法获取您的位置，距离信息将不可用:", error.message);
            }
        );
    } else {
        console.error("您的浏览器不支持地理定位功能。");
    }
}

// ... getUserIP, getBlockedSiteIP, getResultData, getDistance, deg2rad 函数保持不变 ...
function getUserIP() {
    // 【已修改】使用新的API
    fetch("http://ip-api.com/json/?lang=zh-CN")
        .then((response) => response.json())
        .then((data) => {
            const userIpElem = document.getElementById("user-ip");
            // 【已修改】使用新API返回的字段
            userIpElem.textContent = `${data.query} ${data.country} ${data.city}`;
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
            // 【已修改】这里也换成新的 API
            return fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
        })
        .then((response) => response.json())
        .then((info) => {
            const resultElem = document.getElementById("result");
            // 【已修改】使用新API返回的字段
            resultElem.textContent = `${info.query} ${info.country} ${info.regionName} ${info.city} ${info.isp || info.org}`;
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

// 主要修改点
function getDNSInfo() {
    const input = document.getElementById("domain-input").value.trim();
    if (!input) return;

    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(input);
    const isIPv6 = /^[a-fA-F0-9:]+$/.test(input);

    // 【已修改】这里是核心修改，替换了原来的API请求函数
    const fetchIPData = (ip) => fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`).then(response => response.json());

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
            // 【已修改】传递新API返回的IP地址 (data.query)
            .then(ipData => displayResult(ipData, ipData.query))
            .catch(error => {
                console.error("查询域名出错：", error);
                document.getElementById("query-result-container").innerHTML = "<p>查询失败，请输入有效的域名。</p>";
            });
    }
}


// 【重点修改区域】
function displayResult(data, input) {
    const resultContainer = document.getElementById("query-result-container");
    // 【已修改】使用新API返回的字段名，并优化了显示顺序
    resultContainer.innerHTML =
        `<p>IP 地址：${data.query || input}</p>` +
        `<p>归属地：${data.country || ''} ${data.regionName || ''} ${data.city || 'N/A'}</p>` +
        `<p>运营商：${data.isp || data.org || 'N/A'}</p>`; // 优先使用 isp，备选 org

    // 【已修改】检查新API返回的坐标字段 (lat, lon)
    if (!data.lat || !data.lon) {
        console.warn("查询结果缺少坐标信息，无法在地图上显示。");
        if (queryMarker) queryMarker.remove();
        if (queryLine) queryLine.remove();
        return;
    }

    // 【已修改】使用新API返回的坐标字段 (lat, lon)
    const targetLocation = [data.lat, data.lon];

    // 移除上一次的查询标记和连接线
    if (queryMarker) queryMarker.remove();
    if (queryLine) queryLine.remove();
    
    // 添加新的查询标记
    queryMarker = L.marker(targetLocation).addTo(map);

    if (userLocation) {
        // 【已修改】使用新API返回的坐标字段 (lat, lon)
        const distance = getDistance(userLocation[0], userLocation[1], data.lat, data.lon);
        const popupContent = `<b>查询结果</b><br>距您 ${distance} 公里`;
        queryMarker.bindPopup(popupContent).openPopup();

        // 绘制连接线
        queryLine = L.polyline([userLocation, targetLocation], {
            color: 'blue',
            weight: 3,
            opacity: 0.7
        }).addTo(map);

        const bounds = L.latLngBounds([userLocation, targetLocation]);
        map.fitBounds(bounds, { padding: [50, 50] });

    } else {
        console.warn("用户位置未知，仅显示查询目标。");
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

            if (queryMarker) {
                queryMarker.remove();
            }
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
