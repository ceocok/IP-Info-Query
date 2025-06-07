let map;
let marker;

function loadMapScenario() {
    map = new Microsoft.Maps.Map(document.getElementById('map-container'), {
        credentials: 'you key', // Replace with your Bing Maps API key
        mapTypeId: Microsoft.Maps.MapTypeId.aerial, // Change map type to aerial
    });
    map.setOptions({
        showDashboard: false
    });
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
                const userLocation = new Microsoft.Maps.Location(latitude, longitude);

                map.setView({ center: userLocation, zoom: 16 });

                marker = new Microsoft.Maps.Pushpin(userLocation, { title: "您的位置" });
                map.entities.push(marker);
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

// 替换后的 getResultData，使用 https://ipv4_ct.itdog.cn 接口
function getResultData() {
    // 第一步：获取当前 IP
    fetch("https://ipv4_ct.itdog.cn")
        .then((response) => response.json())
        .then((data) => {
            const ip = data.ip;

            // 第二步：根据 IP 调用 ipwho.is 查询详细信息
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

    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(input);
    const isIPv6 = /^[a-fA-F0-9:]+$/.test(input);  // 简单判断是否是 IPv6

    const fetchIPData = (ip) => fetch(`https://ipapi.co/${ip}/json/`).then(response => response.json());

    const fetchDomainData = async (domain) => {
        // 优先 A（IPv4），再 AAAA（IPv6）
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
        // 输入为域名
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

    const targetLocation = new Microsoft.Maps.Location(data.latitude, data.longitude);
    map.setView({ center: targetLocation, zoom: 12 });

    if (marker) {
        map.entities.remove(marker);
    }

    marker = new Microsoft.Maps.Pushpin(targetLocation);
    map.entities.push(marker);

    // 计算当前位置与目标位置距离
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const distance = getDistance(latitude, longitude, data.latitude, data.longitude);
                console.log(`与查询位置的距离：${distance} km`);

                // 可选：用 Infobox 显示距离
                const infobox = new Microsoft.Maps.Infobox(targetLocation, {
                    title: "查询结果",
                    description: `距您 ${distance} 公里`,
                    visible: true
                });
                infobox.setMap(map);
            },
            (error) => {
                console.error("获取当前位置失败：", error);
            }
        );
    } else {
        console.warn("浏览器不支持定位");
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

function searchLocationOnMap() {
    const input = document.getElementById("domain-input").value;
    if (input.trim() !== "") {
        fetch(`https://dev.virtualearth.net/REST/v1/Locations?q=${input}&key=ApBQnD4ziGaBvRvRDcrtIIzVxfePinmMLo4nhc4fp6-2fZEduKVNmpPFu7suLFOM`)
            .then(response => response.json())
            .then(data => {
                const location = data.resourceSets[0].resources[0].point.coordinates;
                map.setView({ center: new Microsoft.Maps.Location(location[0], location[1]), zoom: 12 });

                if (marker) {
                    map.entities.remove(marker);
                }

                marker = new Microsoft.Maps.Pushpin(new Microsoft.Maps.Location(location[0], location[1]));
                map.entities.push(marker);
            })
            .catch(error => console.error('Error:', error));
    }
}

window.addEventListener("load", () => {
    loadMapScenario();
    const domainInput = document.getElementById("domain-input");
    domainInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            getDNSInfo();
        }
        searchLocationOnMap();
    });
});
