// /api/flex-check.js
module.exports = (req, res) => {
  const flexMessage = {
    type: "bubble",
    hero: {
      type: "image",
      url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_2_restaurant.png",
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "ข้อมูลสัญญาของคุณ",
          weight: "bold",
          size: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "md",
          contents: [
            {
              type: "text",
              text: "เริ่มสัญญา: 01/01/2025"
            },
            {
              type: "text",
              text: "รอบบริการถัดไป: 01/06/2025"
            },
            {
              type: "text",
              text: "สถานะ: อยู่ในประกัน"
            }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "uri",
            label: "ดูรายละเอียดสัญญา",
            uri: "https://contract.siamguards.com/check"
          }
        }
      ]
    }
  };

  res.status(200).json(flexMessage);
};
