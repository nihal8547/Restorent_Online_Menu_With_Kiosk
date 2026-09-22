/**
 * Realistic sample payloads matching each delivery platform's native JSON webhook shape.
 */

export function generateSamplePayload(platform) {
  const randNum = Math.floor(10000 + Math.random() * 90000);

  switch (platform.toUpperCase()) {
    case "TALABAT":
      return {
        order_id: `TAL-${randNum}`,
        order_number: `TAL-${randNum}`,
        customer: {
          first_name: "Jassim",
          last_name: "Al-Kuwari",
          mobile: "+974 5512 3456",
        },
        delivery_address: {
          street_name: "Al Waab St, Zone 55",
          building: "Villa 14",
          area: "Al Waab / Aspire",
        },
        order_items: [
          {
            item_name: "Chicken Dum Biryani (Full)",
            unit_price: 38,
            quantity: 2,
            special_instructions: "Extra raita, medium spicy please",
          },
          {
            item_name: "Mango Lassi (Chilled)",
            unit_price: 14,
            quantity: 2,
          },
        ],
        grand_total: 104,
        note: "Talabat Express Rider arriving in 10 mins. Keep order warm.",
      };

    case "SNOONU":
      return {
        orderId: `SNO-${randNum}`,
        order_number: `SNO-${randNum}`,
        customer: {
          fullName: "Noura Al-Thani",
          phone: "+974 6699 8811",
        },
        delivery_address: {
          street: "Lusail Marina Promenade",
          building_no: "Tower B, Apt 1402",
          zone: "Lusail Marina",
        },
        line_items: [
          {
            product_name: "Mutton Rogan Josh Special",
            unitPrice: 48,
            quantity: 1,
            note: "Mild gravy, tender meat",
          },
          {
            product_name: "Garlic Butter Naan",
            unitPrice: 6,
            quantity: 3,
          },
          {
            product_name: "Fresh Mint Lemonade",
            unitPrice: 12,
            quantity: 1,
          },
        ],
        order_total: 78,
        instructions: "Snoonu Red Rider pickup. Ring bell at door.",
      };

    case "KEETA":
      return {
        orderId: `KEE-${randNum}`,
        short_code: `KEE-${randNum}`,
        recipient: {
          name: "Ali Hassan",
          phone: "+974 3344 5566",
        },
        delivery_address: {
          street_name: "C-Ring Road, Near Metro",
          buildingNumber: "Al Mansoura Tower 3",
          area: "Al Mansoura",
        },
        orderItems: [
          {
            itemName: "Butter Chicken Delight",
            price: 42,
            qty: 1,
            remark: "Creamy with extra butter",
          },
          {
            itemName: "Steamed Basmati Jeera Rice",
            price: 16,
            qty: 1,
          },
        ],
        total: 58,
        caution: "Keeta Fast Delivery. Contactless drop-off requested.",
      };

    case "RAFEEQ":
      return {
        order_id: `RAF-${randNum}`,
        display_id: `RAF-${randNum}`,
        customer: {
          name: "Fahad Al-Marri",
          phone: "+974 7788 9900",
        },
        delivery_address: {
          street: "Salwa Road Exit 12",
          building_no: "Compound 4, Villa 8",
          zone: "Ain Khaled",
        },
        items: [
          {
            name: "Grilled Mixed Kebab Platter",
            price: 65,
            qty: 1,
            note: "Extra garlic dip & pickled cucumbers",
          },
          {
            name: "Hummus with Fresh Bread",
            price: 18,
            qty: 1,
          },
        ],
        amount: 83,
        note: "Rafeeq Driver will call customer upon arrival at main gate.",
      };

    case "DELIVEROO":
      return {
        order_id: `DEL-${randNum}`,
        order_number: `DEL-${randNum}`,
        customer: {
          first_name: "Sarah",
          last_name: "Jenkins",
          phone: "+974 5022 3344",
        },
        delivery_address: {
          street_name: "Porto Arabia, Boardwalk",
          building: "Tower 12, Unit 804",
          zone: "The Pearl Qatar",
        },
        order_items: [
          {
            product_name: "Tandoori Whole Roast Chicken",
            price: 52,
            quantity: 1,
            notes: "Crispy skin, cut into 4 pieces",
          },
          {
            product_name: "Spiced Masala French Fries",
            price: 14,
            quantity: 1,
          },
        ],
        total: 66,
        notes: "Deliveroo Teal Bag. Rider ID: RD-904.",
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
